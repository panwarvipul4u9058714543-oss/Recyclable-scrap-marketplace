import type { Listing, SavedSearch, SavedSearchAlert } from "@prisma/client";
import { z } from "zod";
import { listBlockedByIds, listBlockedIds } from "@/lib/blocks/blocks";
import { db } from "@/lib/db";
import {
  type ListingDTO,
  listingToDTO,
} from "@/lib/listings/listings";
import {
  materialCategorySchema,
  quantityUnitSchema,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";
import {
  BULK_BUYER_ROLES,
  type Role,
} from "@/lib/roles";

/**
 * Saved searches let a bulk buyer name a supply query (material, minimum
 * supplier quantity, region substring) and be alerted when a new listing
 * matches. Alerts are fanned out at write time — see
 * `fanOutSavedSearchesForNewListing` — so a buyer who saved a search
 * receives one row per matching listing exactly once, gated by their per-
 * search `alertsEnabled` toggle. Same visibility rules as `/nearby`:
 * ACTIVE only, seller not suspended, no self-listings, no blocks either
 * way with the buyer.
 */

export type SavedSearchErrorCode =
  | "not_found"
  | "forbidden"
  | "not_a_bulk_buyer";

export class SavedSearchError extends Error {
  constructor(public readonly code: SavedSearchErrorCode) {
    super(code);
    this.name = "SavedSearchError";
  }
}

export interface SavedSearchDTO {
  id: string;
  buyerId: string;
  name: string;
  material: MaterialCategory | null;
  supplyMinQuantity: number | null;
  supplyMinQuantityUnit: QuantityUnit | null;
  region: string | null;
  alertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearchAlertDTO {
  id: string;
  savedSearchId: string;
  buyerId: string;
  seenAt: Date | null;
  createdAt: Date;
  listing: ListingDTO;
}

const nullableString = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }, z.union([z.null(), z.string().min(min).max(max)]));

// Both create and update use the same shape; update fields are all optional
// (undefined = leave alone; null explicitly clears).
export const savedSearchInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    material: z.union([z.null(), materialCategorySchema]).optional(),
    supplyMinQuantity: z
      .union([z.null(), z.number().positive().max(1_000_000)])
      .optional(),
    supplyMinQuantityUnit: z
      .union([z.null(), quantityUnitSchema])
      .optional(),
    region: nullableString(2, 120).optional(),
    alertsEnabled: z.boolean().optional(),
  })
  .refine(
    (v) => {
      // If a quantity floor is set (not null / undefined), a unit must also
      // be set so the fan-out compares like with like. undefined = leave alone.
      const qtyProvided =
        v.supplyMinQuantity !== undefined && v.supplyMinQuantity !== null;
      const unitProvided =
        v.supplyMinQuantityUnit !== undefined && v.supplyMinQuantityUnit !== null;
      return !qtyProvided || unitProvided;
    },
    {
      message: "supplyMinQuantityUnit is required when supplyMinQuantity is set",
      path: ["supplyMinQuantityUnit"],
    },
  );

export type SavedSearchInput = z.infer<typeof savedSearchInputSchema>;

function toDTO(row: SavedSearch): SavedSearchDTO {
  return {
    id: row.id,
    buyerId: row.buyerId,
    name: row.name,
    material: row.material as MaterialCategory | null,
    supplyMinQuantity: row.supplyMinQuantity,
    supplyMinQuantityUnit: row.supplyMinQuantityUnit as QuantityUnit | null,
    region: row.region,
    alertsEnabled: row.alertsEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertBulkBuyerRole(userId: string) {
  const roles = await db.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  const held = roles.map((r) => r.role as Role);
  if (!held.some((r) => (BULK_BUYER_ROLES as readonly Role[]).includes(r))) {
    throw new SavedSearchError("not_a_bulk_buyer");
  }
}

async function loadOwned(buyerId: string, id: string): Promise<SavedSearch> {
  const row = await db.savedSearch.findUnique({ where: { id } });
  if (!row) throw new SavedSearchError("not_found");
  if (row.buyerId !== buyerId) throw new SavedSearchError("forbidden");
  return row;
}

export async function createSavedSearch(
  buyerId: string,
  input: unknown,
): Promise<SavedSearchDTO> {
  await assertBulkBuyerRole(buyerId);
  const data = savedSearchInputSchema.parse(input);
  if (data.name === undefined) {
    // Name is required on create; the schema keeps it optional so update can
    // reuse the same shape. Fall through to a Zod-shaped throw for parity.
    throw new z.ZodError([
      {
        code: "custom",
        message: "name is required",
        path: ["name"],
      },
    ]);
  }

  const row = await db.savedSearch.create({
    data: {
      buyerId,
      name: data.name,
      material: data.material ?? null,
      supplyMinQuantity: data.supplyMinQuantity ?? null,
      supplyMinQuantityUnit: data.supplyMinQuantityUnit ?? null,
      region: data.region ?? null,
      alertsEnabled: data.alertsEnabled ?? true,
    },
  });
  return toDTO(row);
}

export async function updateSavedSearch(
  buyerId: string,
  id: string,
  input: unknown,
): Promise<SavedSearchDTO> {
  await loadOwned(buyerId, id);
  const data = savedSearchInputSchema.parse(input);

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.material !== undefined) patch.material = data.material;
  if (data.supplyMinQuantity !== undefined) {
    patch.supplyMinQuantity = data.supplyMinQuantity;
  }
  if (data.supplyMinQuantityUnit !== undefined) {
    patch.supplyMinQuantityUnit = data.supplyMinQuantityUnit;
  }
  if (data.region !== undefined) patch.region = data.region;
  if (data.alertsEnabled !== undefined) patch.alertsEnabled = data.alertsEnabled;

  const row = await db.savedSearch.update({ where: { id }, data: patch });
  return toDTO(row);
}

export async function deleteSavedSearch(
  buyerId: string,
  id: string,
): Promise<void> {
  await loadOwned(buyerId, id);
  await db.savedSearch.delete({ where: { id } });
}

export async function listSavedSearchesForBuyer(
  buyerId: string,
): Promise<SavedSearchDTO[]> {
  const rows = await db.savedSearch.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

// True when the search's filters accept this listing.
function searchMatchesListing(
  search: Pick<
    SavedSearch,
    "material" | "supplyMinQuantity" | "supplyMinQuantityUnit" | "region"
  >,
  listing: Pick<
    Listing,
    "materialCategory" | "quantityMax" | "quantityUnit" | "locality"
  >,
): boolean {
  if (search.material && search.material !== listing.materialCategory) {
    return false;
  }
  if (search.supplyMinQuantity !== null && search.supplyMinQuantityUnit) {
    if (listing.quantityUnit !== search.supplyMinQuantityUnit) return false;
    if (listing.quantityMax < search.supplyMinQuantity) return false;
  }
  if (search.region) {
    const needle = search.region.toLowerCase();
    if (!listing.locality.toLowerCase().includes(needle)) return false;
  }
  return true;
}

/**
 * Insert a SavedSearchAlert row for every buyer whose saved search matches
 * this listing. Skips: non-ACTIVE listings, buyer's own listings, either
 * side of a block, opted-out searches. Returns the number of new rows
 * written; a repeat call for the same listing is idempotent (unique on
 * (savedSearchId, listingId)).
 */
export async function fanOutSavedSearchesForNewListing(
  listingId: string,
): Promise<number> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE") return 0;

  const searches = await db.savedSearch.findMany({
    where: {
      alertsEnabled: true,
      buyerId: { not: listing.sellerId },
      buyer: { suspendedAt: null },
    },
  });
  if (searches.length === 0) return 0;

  const buyerIds = Array.from(new Set(searches.map((s) => s.buyerId)));
  const blocks = await db.block.findMany({
    where: {
      OR: [
        { blockerId: { in: buyerIds }, blockedId: listing.sellerId },
        { blockerId: listing.sellerId, blockedId: { in: buyerIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedBuyers = new Set<string>();
  for (const b of blocks) {
    if (b.blockerId === listing.sellerId) blockedBuyers.add(b.blockedId);
    else blockedBuyers.add(b.blockerId);
  }

  // Pre-check for idempotency: fetch the (savedSearchId) rows this listing
  // already has to avoid unique-constraint noise on a replay.
  const existing = await db.savedSearchAlert.findMany({
    where: {
      listingId: listing.id,
      savedSearchId: { in: searches.map((s) => s.id) },
    },
    select: { savedSearchId: true },
  });
  const alreadyNotified = new Set(existing.map((e) => e.savedSearchId));

  let written = 0;
  for (const search of searches) {
    if (blockedBuyers.has(search.buyerId)) continue;
    if (alreadyNotified.has(search.id)) continue;
    if (!searchMatchesListing(search, listing)) continue;
    await db.savedSearchAlert.create({
      data: {
        savedSearchId: search.id,
        buyerId: search.buyerId,
        listingId: listing.id,
      },
    });
    written += 1;
  }
  return written;
}

/**
 * Alerts for this buyer, unseen first then most-recent within the group so
 * a NEW badge sits at the top of the list.
 */
export async function listSavedSearchAlertsForBuyer(
  buyerId: string,
): Promise<SavedSearchAlertDTO[]> {
  const rows = await db.savedSearchAlert.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: { listing: true },
  });
  // SQLite's NULLS-first ordering on `seenAt` isn't consistently applied via
  // Prisma's `orderBy`, so partition in memory to guarantee unseen-first.
  const unseen = rows.filter((r) => r.seenAt === null);
  const seen = rows.filter((r) => r.seenAt !== null);
  return [...unseen, ...seen].map((r) => ({
    id: r.id,
    savedSearchId: r.savedSearchId,
    buyerId: r.buyerId,
    seenAt: r.seenAt,
    createdAt: r.createdAt,
    listing: listingToDTO(r.listing),
  }));
}

export async function markSavedSearchAlertSeen(
  buyerId: string,
  alertId: string,
): Promise<SavedSearchAlert> {
  const row = await db.savedSearchAlert.findUnique({ where: { id: alertId } });
  if (!row) throw new SavedSearchError("not_found");
  if (row.buyerId !== buyerId) throw new SavedSearchError("forbidden");
  if (row.seenAt) return row;
  return db.savedSearchAlert.update({
    where: { id: alertId },
    data: { seenAt: new Date() },
  });
}
