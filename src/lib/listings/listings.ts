import type { Listing } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  type Availability,
  type MaterialCategory,
  type QuantityUnit,
  availabilitySchema,
  materialCategorySchema,
  quantityUnitSchema,
} from "@/lib/materials";

/** The seller capacities that may post a listing (a subset of the roles). */
export const SELLER_TYPES = ["HOUSEHOLD", "BUSINESS"] as const;
export type SellerType = (typeof SELLER_TYPES)[number];
export const sellerTypeSchema = z.enum(SELLER_TYPES);

export const LISTING_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingErrorCode =
  | "not_found"
  | "forbidden"
  | "closed"
  | "invalid_seller_type"
  | "invalid_transition";

/** A domain error the API layer maps to an HTTP status. */
export class ListingError extends Error {
  constructor(public readonly code: ListingErrorCode) {
    super(code);
    this.name = "ListingError";
  }
}

/** A listing as exposed to the rest of the app (photos decoded from JSON). */
export interface ListingDTO {
  id: string;
  sellerId: string;
  sellerType: SellerType;
  materialCategory: MaterialCategory;
  title: string;
  description: string | null;
  photos: string[];
  quantityMin: number;
  quantityMax: number;
  quantityUnit: QuantityUnit;
  locality: string;
  availability: Availability;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

// An empty description string is treated as "no description".
const descriptionSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(1000).optional(),
);

/** The editable fields of a listing, shared by create and update. */
export const listingInputSchema = z
  .object({
    sellerType: sellerTypeSchema,
    materialCategory: materialCategorySchema,
    title: z.string().trim().min(3).max(120),
    description: descriptionSchema,
    photos: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
    quantityMin: z.number().positive(),
    quantityMax: z.number().positive(),
    quantityUnit: quantityUnitSchema,
    locality: z.string().trim().min(2).max(120),
    availability: availabilitySchema,
  })
  .refine((v) => v.quantityMax >= v.quantityMin, {
    message: "Maximum quantity must be at least the minimum",
    path: ["quantityMax"],
  });

export type ListingInput = z.infer<typeof listingInputSchema>;

function toDTO(row: Listing): ListingDTO {
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(row.photos);
    if (Array.isArray(parsed)) photos = parsed.filter((p) => typeof p === "string");
  } catch {
    photos = [];
  }

  return {
    id: row.id,
    sellerId: row.sellerId,
    sellerType: row.sellerType as SellerType,
    materialCategory: row.materialCategory as MaterialCategory,
    title: row.title,
    description: row.description,
    photos,
    quantityMin: row.quantityMin,
    quantityMax: row.quantityMax,
    quantityUnit: row.quantityUnit as QuantityUnit,
    locality: row.locality,
    availability: row.availability as Availability,
    status: row.status as ListingStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// The persisted column values for a listing's editable fields, shared by
// create and update so the mapping lives in exactly one place.
function toWriteData(data: ListingInput) {
  return {
    sellerType: data.sellerType,
    materialCategory: data.materialCategory,
    title: data.title,
    description: data.description ?? null,
    photos: JSON.stringify(data.photos),
    quantityMin: data.quantityMin,
    quantityMax: data.quantityMax,
    quantityUnit: data.quantityUnit,
    locality: data.locality,
    availability: data.availability,
  };
}

// Ensure the seller actually holds the role they are listing in.
async function assertSellerHoldsType(sellerId: string, sellerType: SellerType) {
  const role = await db.userRole.findUnique({
    where: { userId_role: { userId: sellerId, role: sellerType } },
  });
  if (!role) throw new ListingError("invalid_seller_type");
}

// Load an owned listing row or throw the appropriate domain error.
async function loadOwned(sellerId: string, listingId: string): Promise<Listing> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ListingError("not_found");
  if (listing.sellerId !== sellerId) throw new ListingError("forbidden");
  return listing;
}

export async function createListing(
  sellerId: string,
  input: unknown,
): Promise<ListingDTO> {
  const data = listingInputSchema.parse(input);
  await assertSellerHoldsType(sellerId, data.sellerType);

  const row = await db.listing.create({
    data: { sellerId, ...toWriteData(data) },
  });

  return toDTO(row);
}

export async function updateListing(
  sellerId: string,
  listingId: string,
  input: unknown,
): Promise<ListingDTO> {
  const existing = await loadOwned(sellerId, listingId);
  if (existing.status === "CLOSED") throw new ListingError("closed");

  const data = listingInputSchema.parse(input);
  await assertSellerHoldsType(sellerId, data.sellerType);

  const row = await db.listing.update({
    where: { id: listingId },
    data: toWriteData(data),
  });

  return toDTO(row);
}

// Apply a status change, enforcing ownership and the legal transitions.
async function transition(
  sellerId: string,
  listingId: string,
  from: ListingStatus[],
  to: ListingStatus,
): Promise<ListingDTO> {
  const existing = await loadOwned(sellerId, listingId);
  if (!from.includes(existing.status as ListingStatus)) {
    throw new ListingError("invalid_transition");
  }
  const row = await db.listing.update({
    where: { id: listingId },
    data: { status: to },
  });
  return toDTO(row);
}

export function pauseListing(sellerId: string, listingId: string) {
  return transition(sellerId, listingId, ["ACTIVE"], "PAUSED");
}

export function resumeListing(sellerId: string, listingId: string) {
  return transition(sellerId, listingId, ["PAUSED"], "ACTIVE");
}

export function closeListing(sellerId: string, listingId: string) {
  return transition(sellerId, listingId, ["ACTIVE", "PAUSED"], "CLOSED");
}

export async function getListingForSeller(
  sellerId: string,
  listingId: string,
): Promise<ListingDTO> {
  return toDTO(await loadOwned(sellerId, listingId));
}

export async function listSellerListings(
  sellerId: string,
): Promise<ListingDTO[]> {
  const rows = await db.listing.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function getListing(listingId: string): Promise<ListingDTO | null> {
  const row = await db.listing.findUnique({ where: { id: listingId } });
  return row ? toDTO(row) : null;
}
