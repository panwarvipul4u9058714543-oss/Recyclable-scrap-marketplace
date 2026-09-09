import type { Connection, Interest, Message } from "@prisma/client";
import { db } from "@/lib/db";
import { COLLECTOR_ROLES } from "@/lib/roles";

/** Connection lifecycle. Step 1 introduced the row; steps 2–3 add reservation
 * expiry and chat/mutual-contact-reveal; step 4 adds the terminal COMPLETED
 * and FAILED outcomes with optional actual-quantity / final-price /
 * failure-reason. */
export const CONNECTION_STATUSES = [
  "RESERVED",
  "CANCELLED",
  "EXPIRED",
  "COMPLETED",
  "FAILED",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/**
 * A connection is considered "open" (still holds the listing) while its
 * status is one of these. Kept as a list so later steps can add more open
 * states (e.g. CONFIRMED) without touching the "already reserved" guard.
 */
export const OPEN_CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  "RESERVED",
];

/** How long a reservation lasts before it auto-expires. */
export const RESERVATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type ConnectionErrorCode =
  | "not_found"
  | "forbidden"
  | "listing_not_active"
  | "not_a_collector"
  | "not_interested"
  | "already_selected"
  | "own_listing"
  | "not_reserved"
  | "empty_message"
  | "invalid_outcome";

/** A domain error the API layer maps to an HTTP status. */
export class ConnectionError extends Error {
  constructor(public readonly code: ConnectionErrorCode) {
    super(code);
    this.name = "ConnectionError";
  }
}

export interface InterestDTO {
  id: string;
  listingId: string;
  collectorId: string;
  collectorPhone: string;
  createdAt: Date;
}

export interface ConnectionDTO {
  id: string;
  listingId: string;
  sellerId: string;
  collectorId: string;
  status: ConnectionStatus;
  expiresAt: Date;
  sellerRevealedAt: Date | null;
  collectorRevealedAt: Date | null;
  actualQuantity: number | null;
  finalPrice: number | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageDTO {
  id: string;
  connectionId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

/** The connection plus revealed contact when both parties have revealed. */
export interface ConnectionDetailDTO extends ConnectionDTO {
  sellerPhone: string;
  collectorPhone: string;
  listingTitle: string;
  locality: string;
  /** Exact pickup coordinates — only populated once both parties have revealed. */
  pickup: { latitude: number; longitude: number } | null;
  /** True when the current caller has revealed. */
  youRevealed: boolean;
  /** True when the other party has revealed. */
  counterpartyRevealed: boolean;
  /** True when both parties have revealed; contact + pickup are visible. */
  contactRevealed: boolean;
}

function connectionToDTO(row: Connection): ConnectionDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    sellerId: row.sellerId,
    collectorId: row.collectorId,
    status: row.status as ConnectionStatus,
    expiresAt: row.expiresAt,
    sellerRevealedAt: row.sellerRevealedAt,
    collectorRevealedAt: row.collectorRevealedAt,
    actualQuantity: row.actualQuantity,
    finalPrice: row.finalPrice,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function interestToDTO(
  row: Interest & { collector: { phone: string } },
): InterestDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    collectorId: row.collectorId,
    collectorPhone: row.collector.phone,
    createdAt: row.createdAt,
  };
}

function messageToDTO(row: Message): MessageDTO {
  return {
    id: row.id,
    connectionId: row.connectionId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

async function loadListing(listingId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ConnectionError("not_found");
  return listing;
}

async function assertCollectorRole(userId: string) {
  const held = await db.userRole.findMany({ where: { userId } });
  const roles = held.map((r) => r.role);
  if (!COLLECTOR_ROLES.some((r) => roles.includes(r))) {
    throw new ConnectionError("not_a_collector");
  }
}

/**
 * Transition a RESERVED connection whose expiresAt has passed to EXPIRED and
 * return the updated row. Read paths call this so a stale reservation never
 * leaks as "still open" simply because no timer fired.
 */
async function expireIfDue(row: Connection): Promise<Connection> {
  if (row.status === "RESERVED" && row.expiresAt.getTime() <= Date.now()) {
    return db.connection.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
  }
  return row;
}

/**
 * Return the id of the currently RESERVED connection for a listing, or null.
 * Any RESERVED-but-past-expiry row is expired first so the answer reflects
 * the live state.
 */
async function findActiveReservation(listingId: string) {
  const row = await db.connection.findFirst({
    where: { listingId, status: "RESERVED" },
  });
  if (!row) return null;
  const fresh = await expireIfDue(row);
  return fresh.status === "RESERVED" ? fresh : null;
}

/**
 * Return the set of listing ids that currently hold an active reservation.
 * Used by discovery to hide reserved listings from other collectors.
 */
export async function listingIdsWithActiveReservation(
  listingIds: string[],
): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db.connection.findMany({
    where: { listingId: { in: listingIds }, status: "RESERVED" },
  });
  const active = new Set<string>();
  for (const row of rows) {
    const fresh = await expireIfDue(row);
    if (fresh.status === "RESERVED") active.add(fresh.listingId);
  }
  return active;
}

/**
 * Record a collector's interest in an active listing. Idempotent — if the
 * collector has already expressed interest the existing row is returned.
 */
export async function expressInterest(
  collectorId: string,
  listingId: string,
): Promise<InterestDTO> {
  const listing = await loadListing(listingId);
  if (listing.sellerId === collectorId) {
    throw new ConnectionError("own_listing");
  }
  if (listing.status !== "ACTIVE") {
    throw new ConnectionError("listing_not_active");
  }
  const reserved = await findActiveReservation(listingId);
  if (reserved) throw new ConnectionError("already_selected");
  await assertCollectorRole(collectorId);

  const row = await db.interest.upsert({
    where: { listingId_collectorId: { listingId, collectorId } },
    create: { listingId, collectorId },
    update: {},
    include: { collector: { select: { phone: true } } },
  });

  return interestToDTO(row);
}

/** Remove the collector's interest. A no-op if none exists. */
export async function withdrawInterest(
  collectorId: string,
  listingId: string,
): Promise<void> {
  await db.interest.deleteMany({ where: { listingId, collectorId } });
}

/**
 * Return the interests on one of the seller's listings, newest first. Refuses
 * to reveal interests to anyone but the listing's owner.
 */
export async function listListingInterests(
  sellerId: string,
  listingId: string,
): Promise<InterestDTO[]> {
  const listing = await loadListing(listingId);
  if (listing.sellerId !== sellerId) throw new ConnectionError("forbidden");

  const rows = await db.interest.findMany({
    where: { listingId },
    orderBy: { createdAt: "desc" },
    include: { collector: { select: { phone: true } } },
  });
  return rows.map(interestToDTO);
}

/**
 * Reserve the listing for one of the collectors who has expressed interest.
 * Creates a Connection in RESERVED state with `expiresAt = now + TTL`; at
 * most one non-terminal connection is allowed per listing.
 */
export async function selectBuyer(
  sellerId: string,
  listingId: string,
  collectorId: string,
): Promise<ConnectionDTO> {
  const listing = await loadListing(listingId);
  if (listing.sellerId !== sellerId) throw new ConnectionError("forbidden");
  if (listing.status !== "ACTIVE") {
    throw new ConnectionError("listing_not_active");
  }

  const interest = await db.interest.findUnique({
    where: { listingId_collectorId: { listingId, collectorId } },
  });
  if (!interest) throw new ConnectionError("not_interested");

  const reserved = await findActiveReservation(listingId);
  if (reserved) throw new ConnectionError("already_selected");

  const row = await db.connection.create({
    data: {
      listingId,
      sellerId,
      collectorId,
      status: "RESERVED",
      expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
    },
  });
  return connectionToDTO(row);
}

/** All connections where the caller is the seller, newest first. */
export async function listSellerConnections(
  sellerId: string,
): Promise<ConnectionDTO[]> {
  const rows = await db.connection.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });
  const fresh = await Promise.all(rows.map(expireIfDue));
  return fresh.map(connectionToDTO);
}

/** All connections where the caller is the selected buyer, newest first. */
export async function listCollectorConnections(
  collectorId: string,
): Promise<ConnectionDTO[]> {
  const rows = await db.connection.findMany({
    where: { collectorId },
    orderBy: { createdAt: "desc" },
  });
  const fresh = await Promise.all(rows.map(expireIfDue));
  return fresh.map(connectionToDTO);
}

async function loadForParty(userId: string, connectionId: string) {
  const row = await db.connection.findUnique({ where: { id: connectionId } });
  if (!row) throw new ConnectionError("not_found");
  if (row.sellerId !== userId && row.collectorId !== userId) {
    throw new ConnectionError("not_found");
  }
  return expireIfDue(row);
}

/**
 * Fetch a connection that the caller is a party to (seller or buyer). Anyone
 * else gets a not_found response so we never confirm the connection exists.
 */
export async function getConnectionForParty(
  userId: string,
  connectionId: string,
): Promise<ConnectionDTO> {
  return connectionToDTO(await loadForParty(userId, connectionId));
}

/**
 * Fetch the full connection view for a party: participants' phones, the
 * listing's title + locality, whether the caller/other has revealed, and — if
 * both have — the exact pickup coordinates.
 */
export async function getConnectionDetail(
  userId: string,
  connectionId: string,
): Promise<ConnectionDetailDTO> {
  const row = await loadForParty(userId, connectionId);
  const [seller, collector, listing] = await Promise.all([
    db.user.findUnique({
      where: { id: row.sellerId },
      select: { phone: true },
    }),
    db.user.findUnique({
      where: { id: row.collectorId },
      select: { phone: true },
    }),
    db.listing.findUnique({
      where: { id: row.listingId },
      select: { title: true, locality: true, latitude: true, longitude: true },
    }),
  ]);
  if (!seller || !collector || !listing) throw new ConnectionError("not_found");

  const contactRevealed =
    row.sellerRevealedAt !== null && row.collectorRevealedAt !== null;
  const youRevealed = isSeller(row, userId)
    ? row.sellerRevealedAt !== null
    : row.collectorRevealedAt !== null;
  const counterpartyRevealed = isSeller(row, userId)
    ? row.collectorRevealedAt !== null
    : row.sellerRevealedAt !== null;

  return {
    ...connectionToDTO(row),
    // Phones are only exposed when both parties have revealed.
    sellerPhone: contactRevealed ? seller.phone : maskPhone(seller.phone),
    collectorPhone: contactRevealed
      ? collector.phone
      : maskPhone(collector.phone),
    listingTitle: listing.title,
    locality: listing.locality,
    pickup: contactRevealed
      ? { latitude: listing.latitude, longitude: listing.longitude }
      : null,
    youRevealed,
    counterpartyRevealed,
    contactRevealed,
  };
}

function isSeller(row: Connection, userId: string): boolean {
  return row.sellerId === userId;
}

// Show only the last four digits of a phone number so users can distinguish
// their counterparty without seeing their full contact details.
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "••••";
  return "•••• " + phone.slice(-4);
}

/**
 * Cancel a RESERVED connection. Either party may call this; the connection
 * moves to CANCELLED (terminal) and the listing becomes available for a new
 * selection. Cancelling a non-reserved connection is rejected.
 */
export async function cancelConnection(
  userId: string,
  connectionId: string,
): Promise<ConnectionDTO> {
  const row = await loadForParty(userId, connectionId);
  if (row.status !== "RESERVED") throw new ConnectionError("not_reserved");
  const updated = await db.connection.update({
    where: { id: row.id },
    data: { status: "CANCELLED" },
  });
  return connectionToDTO(updated);
}

/**
 * Mark the caller's side of the mutual contact-reveal as revealed. Once both
 * parties have revealed, `getConnectionDetail` exposes exact phones and the
 * pickup coordinates. Reveal is only meaningful while RESERVED. Repeat calls
 * are idempotent — the timestamp is preserved.
 */
export async function revealContact(
  userId: string,
  connectionId: string,
): Promise<ConnectionDTO> {
  const row = await loadForParty(userId, connectionId);
  if (row.status !== "RESERVED") throw new ConnectionError("not_reserved");

  const alreadyRevealed = isSeller(row, userId)
    ? row.sellerRevealedAt !== null
    : row.collectorRevealedAt !== null;
  if (alreadyRevealed) return connectionToDTO(row);

  const patch = isSeller(row, userId)
    ? { sellerRevealedAt: new Date() }
    : { collectorRevealedAt: new Date() };
  const updated = await db.connection.update({
    where: { id: row.id },
    data: patch,
  });
  return connectionToDTO(updated);
}

/** Optional outcome details recorded when marking a connection completed or
 * failed. All fields are optional per the acceptance criteria (issue #3);
 * positive-number and length rules are checked here. */
export interface OutcomeDetails {
  actualQuantity?: number | null;
  finalPrice?: number | null;
  failureReason?: string | null;
}

function normalizeOutcome(input: OutcomeDetails) {
  const patch: {
    actualQuantity: number | null;
    finalPrice: number | null;
    failureReason: string | null;
  } = { actualQuantity: null, finalPrice: null, failureReason: null };

  if (input.actualQuantity !== undefined && input.actualQuantity !== null) {
    if (
      typeof input.actualQuantity !== "number" ||
      !Number.isFinite(input.actualQuantity) ||
      input.actualQuantity <= 0
    ) {
      throw new ConnectionError("invalid_outcome");
    }
    patch.actualQuantity = input.actualQuantity;
  }

  if (input.finalPrice !== undefined && input.finalPrice !== null) {
    if (
      typeof input.finalPrice !== "number" ||
      !Number.isFinite(input.finalPrice) ||
      input.finalPrice <= 0
    ) {
      throw new ConnectionError("invalid_outcome");
    }
    patch.finalPrice = input.finalPrice;
  }

  if (input.failureReason !== undefined && input.failureReason !== null) {
    const trimmed = String(input.failureReason).trim();
    if (trimmed.length === 0) {
      // A blank reason means "no reason given" — store null rather than "".
      patch.failureReason = null;
    } else if (trimmed.length > 500) {
      throw new ConnectionError("invalid_outcome");
    } else {
      patch.failureReason = trimmed;
    }
  }

  return patch;
}

/**
 * Mark a RESERVED connection as COMPLETED. Optionally records the actual
 * quantity picked up and final price agreed. Either party may call this.
 * `failureReason` from the input is ignored for a completion.
 */
export async function markCompleted(
  userId: string,
  connectionId: string,
  outcome: OutcomeDetails = {},
): Promise<ConnectionDTO> {
  const row = await loadForParty(userId, connectionId);
  if (row.status !== "RESERVED") throw new ConnectionError("not_reserved");
  const patch = normalizeOutcome(outcome);
  const updated = await db.connection.update({
    where: { id: row.id },
    data: {
      status: "COMPLETED",
      actualQuantity: patch.actualQuantity,
      finalPrice: patch.finalPrice,
      // A completed pickup has no failure reason — never keep one from the
      // caller's input even if they passed one.
      failureReason: null,
    },
  });
  return connectionToDTO(updated);
}

/**
 * Mark a RESERVED connection as FAILED. Optionally records the failure
 * reason and any partial quantity/price that was still agreed. Either party
 * may call this.
 */
export async function markFailed(
  userId: string,
  connectionId: string,
  outcome: OutcomeDetails = {},
): Promise<ConnectionDTO> {
  const row = await loadForParty(userId, connectionId);
  if (row.status !== "RESERVED") throw new ConnectionError("not_reserved");
  const patch = normalizeOutcome(outcome);
  const updated = await db.connection.update({
    where: { id: row.id },
    data: {
      status: "FAILED",
      actualQuantity: patch.actualQuantity,
      finalPrice: patch.finalPrice,
      failureReason: patch.failureReason,
    },
  });
  return connectionToDTO(updated);
}

/** Post a chat message on a RESERVED connection. Empty messages are rejected. */
export async function postMessage(
  userId: string,
  connectionId: string,
  body: string,
): Promise<MessageDTO> {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new ConnectionError("empty_message");
  const row = await loadForParty(userId, connectionId);
  if (row.status !== "RESERVED") throw new ConnectionError("not_reserved");

  const message = await db.message.create({
    data: { connectionId: row.id, senderId: userId, body: trimmed },
  });
  return messageToDTO(message);
}

/** List all messages on a connection the caller is a party to, oldest first. */
export async function listMessages(
  userId: string,
  connectionId: string,
): Promise<MessageDTO[]> {
  await loadForParty(userId, connectionId);
  const rows = await db.message.findMany({
    where: { connectionId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(messageToDTO);
}
