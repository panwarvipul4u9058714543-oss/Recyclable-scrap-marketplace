import { z } from "zod";
import { recordEvent } from "@/lib/analytics/events";
import { listBlockedByIds, listBlockedIds } from "@/lib/blocks/blocks";
import { listingIdsWithActiveReservation } from "@/lib/connections/connections";
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
import { listActivePromotionsForListingIds } from "@/lib/monetisation/promotions";
import type { PromotionTier } from "@/lib/monetisation/plans";

/**
 * A listing plus its distance from the caller's search origin. When the
 * listing carries an active paid Promotion, `promoted.tier` says which tier
 * — the UI badges it and the sort surfaces it above non-promoted results at
 * the same distance tier.
 */
export interface DiscoveryResult extends ListingDTO {
  distanceKm: number;
  promoted: { tier: PromotionTier } | null;
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

    // Hide listings from either side of a block: sellers the viewer has
  // blocked, and sellers who have blocked the viewer.
  const [blockedByViewer, blockedByOthers] = await Promise.all([
    listBlockedIds(viewerId),
    listBlockedByIds(viewerId),
  ]);
  const hiddenSellerIds = Array.from(
    new Set([viewerId, ...blockedByViewer, ...blockedByOthers]),
  );

  const rows = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      sellerId: { notIn: hiddenSellerIds },
      // Suspended sellers' listings never appear in discovery — an operator
      // suspension pulls them out of the marketplace until they are reinstated.
      seller: { suspendedAt: null },
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

  // Hide listings that already hold an active reservation for someone else —
  // the seller has picked a buyer and the pickup is in progress.
  const reserved = await listingIdsWithActiveReservation(rows.map((r) => r.id));
  const visible = rows.filter((r) => !reserved.has(r.id));

  const promotions = await listActivePromotionsForListingIds(
    visible.map((r) => r.id),
  );

  const withDistance: DiscoveryResult[] = visible.map((row) => {
    const promo = promotions.get(row.id);
    return {
      ...listingToDTO(row),
      distanceKm: distanceKm(filters.near, {
        latitude: row.latitude,
        longitude: row.longitude,
      }),
      promoted: promo ? { tier: promo.tier } : null,
    };
  });

  const filtered = filters.maxDistanceKm
    ? withDistance.filter((r) => r.distanceKm <= filters.maxDistanceKm!)
    : withDistance;

  // Promoted listings sort above non-promoted, PREMIUM above STANDARD; within
  // each band, nearest first. This is the visibility benefit issue #8 lists
  // for a paid Promotion — the direct-negotiation and payment flow is
  // unchanged; the promotion only reorders and labels.
  const promotionRank = (r: DiscoveryResult): number => {
    if (!r.promoted) return 0;
    return r.promoted.tier === "PREMIUM" ? 2 : 1;
  };
  const sorted = filtered.sort((a, b) => {
    const rankDiff = promotionRank(b) - promotionRank(a);
    if (rankDiff !== 0) return rankDiff;
    return a.distanceKm - b.distanceKm;
  });

  // Record one view per listing the viewer actually saw. Promoted listings
  // additionally emit a PROMOTED_LISTING_VIEWED so operators can measure
  // activation (impressions of paid inventory). Fired in parallel so
  // discovery is not slowed down by analytics; recordEvent swallows failures.
  await Promise.all(
    sorted.flatMap((r) => {
      const events = [
        recordEvent({
          type: "LISTING_VIEWED",
          channel: "HOUSEHOLD",
          actorId: viewerId,
          subjectType: "LISTING",
          subjectId: r.id,
          material: r.materialCategory,
          locality: r.locality,
          metadata: { distanceKm: r.distanceKm },
        }),
      ];
      if (r.promoted) {
        events.push(
          recordEvent({
            type: "PROMOTED_LISTING_VIEWED",
            channel: "HOUSEHOLD",
            actorId: viewerId,
            subjectType: "LISTING",
            subjectId: r.id,
            material: r.materialCategory,
            locality: r.locality,
            metadata: { tier: r.promoted.tier, distanceKm: r.distanceKm },
          }),
        );
      }
      return events;
    }),
  );

  return sorted;
}
