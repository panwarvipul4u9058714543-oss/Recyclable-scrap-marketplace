import type { BulkRequirement } from "@prisma/client";
import { z } from "zod";
import { listBlockedByIds, listBlockedIds } from "@/lib/blocks/blocks";
import { db } from "@/lib/db";
import {
  materialCategorySchema,
  quantityUnitSchema,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";
import { isUserSuspended } from "@/lib/moderation/moderation";
import {
  computeReputation,
  type ReputationSummary,
} from "@/lib/profiles/profiles";
import {
  BULK_BUYER_ROLES,
  isRole,
  type Role,
} from "@/lib/roles";

/**
 * Bulk buy requirements let dealers, businesses and recyclers signal a
 * larger or recurring need for a specific material — the platform surfaces
 * these to small collectors and dealers who might have the supply. It is a
 * marketplace signal, not a promise of physical aggregation: no lot is
 * created, no transport is arranged; the connection lifecycle for a
 * bulk match reuses the same interest / reservation / reveal / outcome
 * flow the rest of the marketplace uses.
 */

export type BulkRequirementErrorCode =
  | "not_found"
  | "forbidden"
  | "closed"
  | "not_a_bulk_buyer"
  | "suspended";

export class BulkRequirementError extends Error {
  constructor(public readonly code: BulkRequirementErrorCode) {
    super(code);
    this.name = "BulkRequirementError";
  }
}

export const BULK_REQUIREMENT_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type BulkRequirementStatus = (typeof BULK_REQUIREMENT_STATUSES)[number];

/** Verification signals we surface with every requirement so a supplier can
 *  gauge risk before contact. Never includes phone or exact address. */
export interface BuyerBadge {
  id: string;
  displayName: string | null;
  organisationName: string | null;
  registrationId: string | null;
  roles: Role[];
  reputation: ReputationSummary;
  isSuspended: boolean;
}

export interface BulkRequirementDTO {
  id: string;
  buyerId: string;
  material: MaterialCategory;
  minQuantity: number;
  minQuantityUnit: QuantityUnit;
  qualityNotes: string | null;
  region: string;
  deadlineAt: Date | null;
  status: BulkRequirementStatus;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkRequirementWithBuyer extends BulkRequirementDTO {
  buyer: BuyerBadge;
}

const optionalIsoDate = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" || v instanceof Date ? new Date(v) : v;
}, z.union([z.null(), z.date()]));

const optionalString = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.union([z.null(), z.string().min(min).max(max)]),
  );

export const bulkRequirementInputSchema = z
  .object({
    material: materialCategorySchema,
    minQuantity: z.number().positive().max(1_000_000),
    minQuantityUnit: quantityUnitSchema,
    qualityNotes: optionalString(2, 500).optional(),
    region: z.string().trim().min(2).max(120),
    deadlineAt: optionalIsoDate.optional(),
  })
  .refine(
    (v) => v.deadlineAt === null || v.deadlineAt === undefined
      ? true
      : v.deadlineAt.getTime() > Date.now(),
    { message: "deadlineAt must be in the future", path: ["deadlineAt"] },
  );

export type BulkRequirementInput = z.infer<typeof bulkRequirementInputSchema>;

function toDTO(row: BulkRequirement): BulkRequirementDTO {
  return {
    id: row.id,
    buyerId: row.buyerId,
    material: row.material as MaterialCategory,
    minQuantity: row.minQuantity,
    minQuantityUnit: row.minQuantityUnit as QuantityUnit,
    qualityNotes: row.qualityNotes,
    region: row.region,
    deadlineAt: row.deadlineAt,
    status: row.status as BulkRequirementStatus,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertBulkBuyerRole(userId: string): Promise<void> {
  const roles = await db.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  const held = roles.map((r) => r.role as Role);
  const isBulkBuyer = held.some((r) =>
    (BULK_BUYER_ROLES as readonly Role[]).includes(r),
  );
  if (!isBulkBuyer) throw new BulkRequirementError("not_a_bulk_buyer");
}

async function loadOwned(
  buyerId: string,
  id: string,
): Promise<BulkRequirement> {
  const row = await db.bulkRequirement.findUnique({ where: { id } });
  if (!row) throw new BulkRequirementError("not_found");
  if (row.buyerId !== buyerId) throw new BulkRequirementError("forbidden");
  return row;
}

function toWriteData(input: BulkRequirementInput) {
  return {
    material: input.material,
    minQuantity: input.minQuantity,
    minQuantityUnit: input.minQuantityUnit,
    qualityNotes: input.qualityNotes ?? null,
    region: input.region,
    deadlineAt: input.deadlineAt ?? null,
  };
}

export async function createBulkRequirement(
  buyerId: string,
  input: unknown,
): Promise<BulkRequirementDTO> {
  if (await isUserSuspended(buyerId)) {
    throw new BulkRequirementError("suspended");
  }
  await assertBulkBuyerRole(buyerId);
  const data = bulkRequirementInputSchema.parse(input);

  const row = await db.bulkRequirement.create({
    data: { buyerId, ...toWriteData(data) },
  });
  return toDTO(row);
}

export async function updateBulkRequirement(
  buyerId: string,
  id: string,
  input: unknown,
): Promise<BulkRequirementDTO> {
  if (await isUserSuspended(buyerId)) {
    throw new BulkRequirementError("suspended");
  }
  const existing = await loadOwned(buyerId, id);
  if (existing.status === "CLOSED") {
    throw new BulkRequirementError("closed");
  }
  const data = bulkRequirementInputSchema.parse(input);

  const row = await db.bulkRequirement.update({
    where: { id },
    data: toWriteData(data),
  });
  return toDTO(row);
}

export async function closeBulkRequirement(
  buyerId: string,
  id: string,
): Promise<BulkRequirementDTO> {
  const existing = await loadOwned(buyerId, id);
  if (existing.status === "CLOSED") return toDTO(existing);

  const row = await db.bulkRequirement.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  return toDTO(row);
}

export async function listBulkRequirementsForBuyer(
  buyerId: string,
): Promise<BulkRequirementDTO[]> {
  const rows = await db.bulkRequirement.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

async function buyerBadge(userId: string): Promise<BuyerBadge> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, profile: true },
  });
  if (!user) {
    // Shouldn't happen because we FK from BulkRequirement.buyerId, but guard
    // for read-time robustness. The row's own values are still useful.
    return {
      id: userId,
      displayName: null,
      organisationName: null,
      registrationId: null,
      roles: [],
      reputation: await computeReputation(userId),
      isSuspended: false,
    };
  }
  return {
    id: user.id,
    displayName: user.profile?.displayName ?? null,
    organisationName: user.profile?.organisationName ?? null,
    registrationId: user.profile?.registrationId ?? null,
    roles: user.roles.map((r) => r.role).filter(isRole),
    reputation: await computeReputation(userId),
    isSuspended: user.suspendedAt !== null,
  };
}

export async function getBulkRequirement(
  id: string,
): Promise<BulkRequirementWithBuyer | null> {
  const row = await db.bulkRequirement.findUnique({ where: { id } });
  if (!row) return null;
  const buyer = await buyerBadge(row.buyerId);
  return { ...toDTO(row), buyer };
}

export interface SearchBulkRequirementsInput {
  material?: MaterialCategory;
  /** How much the supplier can actually deliver. Requirements whose asked
   *  minimum is larger than this — or in a different unit — are excluded. */
  supplyQuantity?: number;
  supplyQuantityUnit?: QuantityUnit;
  region?: string;
  buyerRole?: Role;
  /** When set, requirements from either side of a block with this user are
   *  hidden — matches `/nearby` visibility. */
  viewerId?: string;
}

export async function searchBulkRequirements(
  input: SearchBulkRequirementsInput,
): Promise<BulkRequirementWithBuyer[]> {
  const hiddenBuyerIds = new Set<string>();
  if (input.viewerId) {
    const [blockedByViewer, blockedByOthers] = await Promise.all([
      listBlockedIds(input.viewerId),
      listBlockedByIds(input.viewerId),
    ]);
    for (const id of blockedByViewer) hiddenBuyerIds.add(id);
    for (const id of blockedByOthers) hiddenBuyerIds.add(id);
    // Never show your own requirements as things you can respond to.
    hiddenBuyerIds.add(input.viewerId);
  }

  const now = new Date();

  const rows = await db.bulkRequirement.findMany({
    where: {
      status: "ACTIVE",
      ...(input.material ? { material: input.material } : {}),
      ...(input.supplyQuantity !== undefined && input.supplyQuantityUnit
        ? {
            minQuantityUnit: input.supplyQuantityUnit,
            minQuantity: { lte: input.supplyQuantity },
          }
        : {}),
      ...(input.region
        ? { region: { contains: input.region } }
        : {}),
      ...(hiddenBuyerIds.size > 0
        ? { buyerId: { notIn: Array.from(hiddenBuyerIds) } }
        : {}),
      buyer: {
        suspendedAt: null,
        ...(input.buyerRole
          ? { roles: { some: { role: input.buyerRole } } }
          : {}),
      },
      OR: [{ deadlineAt: null }, { deadlineAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const badges = new Map<string, BuyerBadge>();
  for (const row of rows) {
    if (!badges.has(row.buyerId)) {
      badges.set(row.buyerId, await buyerBadge(row.buyerId));
    }
  }
  return rows.map((row) => ({
    ...toDTO(row),
    // A badge is guaranteed by the loop above.
    buyer: badges.get(row.buyerId) as BuyerBadge,
  }));
}
