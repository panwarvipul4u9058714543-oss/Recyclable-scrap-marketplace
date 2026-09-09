import type { BulkResponse, BulkResponseMessage } from "@prisma/client";
import { z } from "zod";
import { isBlockedEitherWay } from "@/lib/blocks/blocks";
import { db } from "@/lib/db";
import { quantityUnitSchema, type QuantityUnit } from "@/lib/materials";
import { isUserSuspended } from "@/lib/moderation/moderation";
import {
  BULK_SUPPLIER_ROLES,
  type Role,
} from "@/lib/roles";

/**
 * Bulk response lifecycle. Parallel to the household Connection lifecycle,
 * scoped to one BulkRequirement:
 *
 *   PENDING → SELECTED → COMPLETED | FAILED | CANCELLED
 *   PENDING → WITHDRAWN
 *
 * A SELECTED response opens the same mutual-interest / privacy / outcome
 * flow the rest of the marketplace uses — chat via BulkResponseMessage, and
 * mutual contact reveal masks the counterparty's phone until both parties
 * have revealed.
 */

export type BulkResponseErrorCode =
  | "not_found"
  | "forbidden"
  | "not_a_bulk_supplier"
  | "requirement_not_active"
  | "own_requirement"
  | "already_selected"
  | "not_pending"
  | "not_selected"
  | "empty_message"
  | "invalid_outcome"
  | "blocked"
  | "suspended";

export class BulkResponseError extends Error {
  constructor(public readonly code: BulkResponseErrorCode) {
    super(code);
    this.name = "BulkResponseError";
  }
}

export const BULK_RESPONSE_STATUSES = [
  "PENDING",
  "WITHDRAWN",
  "SELECTED",
  "CANCELLED",
  "COMPLETED",
  "FAILED",
] as const;
export type BulkResponseStatus = (typeof BULK_RESPONSE_STATUSES)[number];

/** Reservation TTL for a selected bulk response — matches the household TTL. */
export const BULK_RESERVATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const respondInputSchema = z.object({
  offeredQuantity: z.number().positive().max(1_000_000),
  offeredQuantityUnit: quantityUnitSchema,
  notes: z
    .preprocess(
      (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v !== "string") return v;
        const trimmed = v.trim();
        return trimmed === "" ? null : trimmed;
      },
      z.union([z.null(), z.string().min(2).max(500)]),
    )
    .optional(),
});

export type RespondInput = z.infer<typeof respondInputSchema>;

export interface BulkResponseDTO {
  id: string;
  requirementId: string;
  supplierId: string;
  offeredQuantity: number;
  offeredQuantityUnit: QuantityUnit;
  notes: string | null;
  status: BulkResponseStatus;
  selectedAt: Date | null;
  expiresAt: Date | null;
  buyerRevealedAt: Date | null;
  supplierRevealedAt: Date | null;
  actualQuantity: number | null;
  finalPrice: number | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A SELECTED-and-beyond response detail — masks contact until both reveal. */
export interface BulkResponseDetailDTO extends BulkResponseDTO {
  buyerId: string;
  buyerPhone: string;
  supplierPhone: string;
  requirementRegion: string;
  requirementMaterial: string;
  requirementMinQuantity: number;
  requirementMinQuantityUnit: string;
  youRevealed: boolean;
  counterpartyRevealed: boolean;
  contactRevealed: boolean;
}

export interface BulkMessageDTO {
  id: string;
  responseId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

function toDTO(row: BulkResponse): BulkResponseDTO {
  return {
    id: row.id,
    requirementId: row.requirementId,
    supplierId: row.supplierId,
    offeredQuantity: row.offeredQuantity,
    offeredQuantityUnit: row.offeredQuantityUnit as QuantityUnit,
    notes: row.notes,
    status: row.status as BulkResponseStatus,
    selectedAt: row.selectedAt,
    expiresAt: row.expiresAt,
    buyerRevealedAt: row.buyerRevealedAt,
    supplierRevealedAt: row.supplierRevealedAt,
    actualQuantity: row.actualQuantity,
    finalPrice: row.finalPrice,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertSupplierRole(userId: string) {
  const held = await db.userRole.findMany({ where: { userId } });
  const roles = held.map((r) => r.role as Role);
  if (!roles.some((r) => (BULK_SUPPLIER_ROLES as readonly Role[]).includes(r))) {
    throw new BulkResponseError("not_a_bulk_supplier");
  }
}

async function loadRequirement(requirementId: string) {
  const req = await db.bulkRequirement.findUnique({
    where: { id: requirementId },
  });
  if (!req) throw new BulkResponseError("not_found");
  return req;
}

async function loadResponseForParty(
  userId: string,
  responseId: string,
): Promise<{ row: BulkResponse; buyerId: string }> {
  const row = await db.bulkResponse.findUnique({ where: { id: responseId } });
  if (!row) throw new BulkResponseError("not_found");
  const req = await db.bulkRequirement.findUnique({
    where: { id: row.requirementId },
    select: { buyerId: true },
  });
  if (!req) throw new BulkResponseError("not_found");
  if (row.supplierId !== userId && req.buyerId !== userId) {
    throw new BulkResponseError("not_found");
  }
  return { row, buyerId: req.buyerId };
}

export async function respondToBulkRequirement(
  supplierId: string,
  requirementId: string,
  input: unknown,
): Promise<BulkResponseDTO> {
  if (await isUserSuspended(supplierId)) {
    throw new BulkResponseError("suspended");
  }
  await assertSupplierRole(supplierId);
  const data = respondInputSchema.parse(input);

  const req = await loadRequirement(requirementId);
  if (req.buyerId === supplierId) {
    throw new BulkResponseError("own_requirement");
  }
  if (req.status !== "ACTIVE") {
    throw new BulkResponseError("requirement_not_active");
  }
  if (await isUserSuspended(req.buyerId)) {
    throw new BulkResponseError("requirement_not_active");
  }
  if (await isBlockedEitherWay(supplierId, req.buyerId)) {
    throw new BulkResponseError("blocked");
  }

  // Idempotent: if the supplier already has a non-terminal response on this
  // requirement, return it unchanged. Terminal responses (WITHDRAWN /
  // CANCELLED / COMPLETED / FAILED) are archived; a new response would need
  // its own row, but we don't expose that flow yet — one attempt per
  // (requirement, supplier) is enough for the current AC.
  const existing = await db.bulkResponse.findFirst({
    where: {
      requirementId,
      supplierId,
      status: { in: ["PENDING", "SELECTED"] },
    },
  });
  if (existing) return toDTO(existing);

  const row = await db.bulkResponse.create({
    data: {
      requirementId,
      supplierId,
      offeredQuantity: data.offeredQuantity,
      offeredQuantityUnit: data.offeredQuantityUnit,
      notes: data.notes ?? null,
    },
  });
  return toDTO(row);
}

export async function withdrawBulkResponse(
  supplierId: string,
  responseId: string,
): Promise<BulkResponseDTO> {
  const row = await db.bulkResponse.findUnique({ where: { id: responseId } });
  if (!row || row.supplierId !== supplierId) {
    throw new BulkResponseError("not_found");
  }
  if (row.status !== "PENDING") {
    throw new BulkResponseError("not_pending");
  }
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: { status: "WITHDRAWN" },
  });
  return toDTO(updated);
}

export async function listResponsesForRequirement(
  buyerId: string,
  requirementId: string,
): Promise<BulkResponseDTO[]> {
  const req = await loadRequirement(requirementId);
  if (req.buyerId !== buyerId) throw new BulkResponseError("forbidden");
  const rows = await db.bulkResponse.findMany({
    where: { requirementId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function listResponsesForSupplier(
  supplierId: string,
): Promise<BulkResponseDTO[]> {
  const rows = await db.bulkResponse.findMany({
    where: { supplierId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function selectBulkResponse(
  buyerId: string,
  responseId: string,
): Promise<BulkResponseDTO> {
  if (await isUserSuspended(buyerId)) {
    throw new BulkResponseError("suspended");
  }
  const row = await db.bulkResponse.findUnique({ where: { id: responseId } });
  if (!row) throw new BulkResponseError("not_found");
  const req = await db.bulkRequirement.findUnique({
    where: { id: row.requirementId },
  });
  if (!req || req.buyerId !== buyerId) {
    throw new BulkResponseError("not_found");
  }
  if (req.status !== "ACTIVE") {
    throw new BulkResponseError("requirement_not_active");
  }
  if (row.status !== "PENDING") {
    throw new BulkResponseError("not_pending");
  }
  if (await isBlockedEitherWay(buyerId, row.supplierId)) {
    throw new BulkResponseError("blocked");
  }

  const alreadySelected = await db.bulkResponse.findFirst({
    where: {
      requirementId: row.requirementId,
      status: "SELECTED",
    },
  });
  if (alreadySelected) throw new BulkResponseError("already_selected");

  const now = new Date();
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: {
      status: "SELECTED",
      selectedAt: now,
      expiresAt: new Date(now.getTime() + BULK_RESERVATION_TTL_MS),
    },
  });
  return toDTO(updated);
}

export async function cancelBulkResponse(
  userId: string,
  responseId: string,
): Promise<BulkResponseDTO> {
  const { row } = await loadResponseForParty(userId, responseId);
  if (row.status !== "SELECTED" && row.status !== "PENDING") {
    throw new BulkResponseError("not_selected");
  }
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: { status: "CANCELLED" },
  });
  return toDTO(updated);
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "••••";
  return "•••• " + phone.slice(-4);
}

export async function getBulkResponseDetail(
  userId: string,
  responseId: string,
): Promise<BulkResponseDetailDTO> {
  const { row, buyerId } = await loadResponseForParty(userId, responseId);
  const [buyer, supplier, requirement] = await Promise.all([
    db.user.findUnique({ where: { id: buyerId }, select: { phone: true } }),
    db.user.findUnique({
      where: { id: row.supplierId },
      select: { phone: true },
    }),
    db.bulkRequirement.findUnique({
      where: { id: row.requirementId },
      select: {
        region: true,
        material: true,
        minQuantity: true,
        minQuantityUnit: true,
      },
    }),
  ]);
  if (!buyer || !supplier || !requirement) {
    throw new BulkResponseError("not_found");
  }
  const contactRevealed =
    row.buyerRevealedAt !== null && row.supplierRevealedAt !== null;
  const isBuyer = userId === buyerId;
  const youRevealed = isBuyer
    ? row.buyerRevealedAt !== null
    : row.supplierRevealedAt !== null;
  const counterpartyRevealed = isBuyer
    ? row.supplierRevealedAt !== null
    : row.buyerRevealedAt !== null;

  return {
    ...toDTO(row),
    buyerId,
    buyerPhone: contactRevealed ? buyer.phone : maskPhone(buyer.phone),
    supplierPhone: contactRevealed
      ? supplier.phone
      : maskPhone(supplier.phone),
    requirementRegion: requirement.region,
    requirementMaterial: requirement.material,
    requirementMinQuantity: requirement.minQuantity,
    requirementMinQuantityUnit: requirement.minQuantityUnit,
    youRevealed,
    counterpartyRevealed,
    contactRevealed,
  };
}

export async function revealBulkContact(
  userId: string,
  responseId: string,
): Promise<BulkResponseDTO> {
  const { row, buyerId } = await loadResponseForParty(userId, responseId);
  if (row.status !== "SELECTED") {
    throw new BulkResponseError("not_selected");
  }
  const isBuyer = userId === buyerId;
  const alreadyRevealed = isBuyer
    ? row.buyerRevealedAt !== null
    : row.supplierRevealedAt !== null;
  if (alreadyRevealed) return toDTO(row);

  const patch = isBuyer
    ? { buyerRevealedAt: new Date() }
    : { supplierRevealedAt: new Date() };
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: patch,
  });
  return toDTO(updated);
}

export interface BulkOutcomeDetails {
  actualQuantity?: number | null;
  finalPrice?: number | null;
  failureReason?: string | null;
}

function normalizeOutcome(input: BulkOutcomeDetails) {
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
      throw new BulkResponseError("invalid_outcome");
    }
    patch.actualQuantity = input.actualQuantity;
  }
  if (input.finalPrice !== undefined && input.finalPrice !== null) {
    if (
      typeof input.finalPrice !== "number" ||
      !Number.isFinite(input.finalPrice) ||
      input.finalPrice <= 0
    ) {
      throw new BulkResponseError("invalid_outcome");
    }
    patch.finalPrice = input.finalPrice;
  }
  if (input.failureReason !== undefined && input.failureReason !== null) {
    const trimmed = String(input.failureReason).trim();
    if (trimmed.length === 0) patch.failureReason = null;
    else if (trimmed.length > 500) {
      throw new BulkResponseError("invalid_outcome");
    } else patch.failureReason = trimmed;
  }
  return patch;
}

export async function markBulkCompleted(
  userId: string,
  responseId: string,
  outcome: BulkOutcomeDetails = {},
): Promise<BulkResponseDTO> {
  const { row } = await loadResponseForParty(userId, responseId);
  if (row.status !== "SELECTED") {
    throw new BulkResponseError("not_selected");
  }
  const patch = normalizeOutcome(outcome);
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: {
      status: "COMPLETED",
      actualQuantity: patch.actualQuantity,
      finalPrice: patch.finalPrice,
      failureReason: null,
    },
  });
  return toDTO(updated);
}

export async function markBulkFailed(
  userId: string,
  responseId: string,
  outcome: BulkOutcomeDetails = {},
): Promise<BulkResponseDTO> {
  const { row } = await loadResponseForParty(userId, responseId);
  if (row.status !== "SELECTED") {
    throw new BulkResponseError("not_selected");
  }
  const patch = normalizeOutcome(outcome);
  const updated = await db.bulkResponse.update({
    where: { id: responseId },
    data: {
      status: "FAILED",
      actualQuantity: patch.actualQuantity,
      finalPrice: patch.finalPrice,
      failureReason: patch.failureReason,
    },
  });
  return toDTO(updated);
}

export async function postBulkMessage(
  senderId: string,
  responseId: string,
  body: string,
): Promise<BulkMessageDTO> {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new BulkResponseError("empty_message");
  if (await isUserSuspended(senderId)) {
    throw new BulkResponseError("suspended");
  }
  const { row, buyerId } = await loadResponseForParty(senderId, responseId);
  if (row.status !== "SELECTED") {
    throw new BulkResponseError("not_selected");
  }
  const counterpartyId =
    senderId === buyerId ? row.supplierId : buyerId;
  if (await isBlockedEitherWay(senderId, counterpartyId)) {
    throw new BulkResponseError("blocked");
  }
  const message = await db.bulkResponseMessage.create({
    data: { responseId, senderId, body: trimmed },
  });
  return messageToDTO(message);
}

export async function listBulkMessages(
  userId: string,
  responseId: string,
): Promise<BulkMessageDTO[]> {
  await loadResponseForParty(userId, responseId);
  const rows = await db.bulkResponseMessage.findMany({
    where: { responseId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(messageToDTO);
}

function messageToDTO(row: BulkResponseMessage): BulkMessageDTO {
  return {
    id: row.id,
    responseId: row.responseId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
  };
}
