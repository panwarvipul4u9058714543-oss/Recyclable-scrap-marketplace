import type { Connection, Interest } from "@prisma/client";
import { db } from "@/lib/db";
import { COLLECTOR_ROLES } from "@/lib/roles";

/** Connection lifecycle. Step 1 only creates SELECTED rows; later steps add
 * RESERVED, chat/contact reveal, and the terminal COMPLETED/CANCELLED/
 * FAILED/EXPIRED states. */
export const CONNECTION_STATUSES = ["SELECTED"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/**
 * A connection is considered "open" (still holds the listing) while its
 * status is one of these. Kept as a set so later steps can add
 * RESERVED / CONFIRMED without touching the "already selected" guard.
 */
export const OPEN_CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  "SELECTED",
];

export type ConnectionErrorCode =
  | "not_found"
  | "forbidden"
  | "listing_not_active"
  | "not_a_collector"
  | "not_interested"
  | "already_selected"
  | "own_listing";

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
  createdAt: Date;
  updatedAt: Date;
}

function connectionToDTO(row: Connection): ConnectionDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    sellerId: row.sellerId,
    collectorId: row.collectorId,
    status: row.status as ConnectionStatus,
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
 * Create a SELECTED connection between the seller's listing and one of the
 * collectors who has already expressed interest. At most one non-terminal
 * connection is allowed per listing.
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

  const openConnection = await db.connection.findFirst({
    where: { listingId, status: { in: [...OPEN_CONNECTION_STATUSES] } },
  });
  if (openConnection) throw new ConnectionError("already_selected");

  const row = await db.connection.create({
    data: { listingId, sellerId, collectorId, status: "SELECTED" },
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
  return rows.map(connectionToDTO);
}

/** All connections where the caller is the selected buyer, newest first. */
export async function listCollectorConnections(
  collectorId: string,
): Promise<ConnectionDTO[]> {
  const rows = await db.connection.findMany({
    where: { collectorId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(connectionToDTO);
}

/**
 * Fetch a connection that the caller is a party to (seller or buyer). Anyone
 * else gets a not_found response so we never confirm the connection exists.
 */
export async function getConnectionForParty(
  userId: string,
  connectionId: string,
): Promise<ConnectionDTO> {
  const row = await db.connection.findUnique({ where: { id: connectionId } });
  if (!row) throw new ConnectionError("not_found");
  if (row.sellerId !== userId && row.collectorId !== userId) {
    throw new ConnectionError("not_found");
  }
  return connectionToDTO(row);
}
