import { z } from "zod";
import { db } from "@/lib/db";
import {
  type ListingDTO,
  listingToDTO,
} from "@/lib/listings/listings";
import {
  availabilitySchema,
  materialCategorySchema,
  quantityUnitSchema,
} from "@/lib/materials";

/** A listing plus its distance from the caller's search origin. */
export interface DiscoveryResult extends ListingDTO {
  distanceKm: number;
}

const originSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const discoveryFiltersSchema = z
  .object({
    near: originSchema,
    materialCategory: materialCategorySchema.optional(),
    availability: availabilitySchema.optional(),
    minQuantity: z.number().positive().optional(),
    quantityUnit: quantityUnitSchema.optional(),
    maxDistanceKm: z.number().positive().optional(),
  })
  .refine((v) => v.minQuantity === undefined || v.quantityUnit !== undefined, {
    message: "quantityUnit is required when minQuantity is set",
    path: ["quantityUnit"],
  });

export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres between two lat/lng points, using the
 * Haversine formula. Good enough for city-scale distances on a marketplace;
 * for cross-continent accuracy a spheroid model would be needed.
 */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Find active listings near the given origin, filtered by material, quantity
 * (in a matching unit), availability and maximum distance. Excludes the
 * viewer's own listings and returns results sorted by ascending distance.
 *
 * Distance filtering happens in the app rather than the database because
 * SQLite has no built-in great-circle function; at marketplace scale this is
 * fine. If catalogue size ever demands it, add a bounding-box prefilter.
 */
export async function discoverNearby(
  viewerId: string,
  input: unknown,
): Promise<DiscoveryResult[]> {
  const filters = discoveryFiltersSchema.parse(input);

  const rows = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      sellerId: { not: viewerId },
      ...(filters.materialCategory
        ? { materialCategory: filters.materialCategory }
        : {}),
      ...(filters.availability ? { availability: filters.availability } : {}),
      ...(filters.quantityUnit
        ? {
            quantityUnit: filters.quantityUnit,
            ...(filters.minQuantity !== undefined
              ? { quantityMax: { gte: filters.minQuantity } }
              : {}),
          }
        : {}),
    },
  });

  const withDistance = rows.map((row) => ({
    ...listingToDTO(row),
    distanceKm: distanceKm(filters.near, {
      latitude: row.latitude,
      longitude: row.longitude,
    }),
  }));

  const filtered = filters.maxDistanceKm
    ? withDistance.filter((r) => r.distanceKm <= filters.maxDistanceKm!)
    : withDistance;

  return filtered.sort((a, b) => a.distanceKm - b.distanceKm);
}
