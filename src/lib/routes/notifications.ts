import type { Listing, RouteNotification } from "@prisma/client";
import { recordEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { detourKmFor, type RouteDTO } from "@/lib/routes/routes";
import {
  type ListingDTO,
  listingToDTO,
} from "@/lib/listings/listings";

/**
 * Route-match notifications. When a listing is created, `fanOutForNewListing`
 * inserts a `RouteNotification` for every collector whose ACTIVE route
 * matches the listing under the same rules `findMatchingListings` uses:
 * materials, minQuantity+unit, maxDetour, blocks either way, suspension,
 * not-your-own-listing. The collector's `notifyOnRouteMatch` preference
 * gates delivery so a collector who opted out never receives a row.
 *
 * The (collectorId, listingId) unique key means re-running the fan-out for
 * the same listing is a no-op — safe to call more than once.
 */

export type RouteNotificationErrorCode = "not_found" | "forbidden";

export class RouteNotificationError extends Error {
  constructor(public readonly code: RouteNotificationErrorCode) {
    super(code);
    this.name = "RouteNotificationError";
  }
}

export interface RouteNotificationDTO {
  id: string;
  collectorId: string;
  routeId: string;
  seenAt: Date | null;
  createdAt: Date;
  listing: ListingDTO;
}

function parseMaterials(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// True if the collector's route filters accept this listing.
function routeMatchesListing(
  route: Pick<
    RouteDTO,
    | "originLatitude"
    | "originLongitude"
    | "destLatitude"
    | "destLongitude"
    | "maxDetourKm"
    | "acceptedMaterials"
    | "minQuantity"
    | "minQuantityUnit"
  >,
  listing: Pick<
    Listing,
    "materialCategory" | "quantityMax" | "quantityUnit" | "latitude" | "longitude"
  >,
): boolean {
  if (
    route.acceptedMaterials.length > 0 &&
    !route.acceptedMaterials.includes(listing.materialCategory)
  ) {
    return false;
  }
  if (route.minQuantity !== null && route.minQuantityUnit !== null) {
    if (listing.quantityUnit !== route.minQuantityUnit) return false;
    if (listing.quantityMax < route.minQuantity) return false;
  }
  const detour = detourKmFor(
    { latitude: route.originLatitude, longitude: route.originLongitude },
    { latitude: route.destLatitude, longitude: route.destLongitude },
    { latitude: listing.latitude, longitude: listing.longitude },
  );
  return detour <= route.maxDetourKm;
}

/**
 * Insert RouteNotification rows for every ACTIVE route that matches this
 * listing. Skips: PAUSED/CLOSED listings, own-listings, suspended
 * collectors, opted-out collectors, and either side of a block. Returns the
 * number of rows actually written; a repeat call for the same listing
 * returns 0 because of the (collectorId, listingId) unique key.
 */
export async function fanOutForNewListing(
  listingId: string,
): Promise<number> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE") return 0;

  // Load candidate routes and their collectors' notification preference in a
  // single query so we do not N+1 the fan-out.
  const routes = await db.route.findMany({
    where: {
      status: "ACTIVE",
      collectorId: { not: listing.sellerId },
      collector: {
        suspendedAt: null,
        notifyOnRouteMatch: true,
      },
    },
    include: { collector: { select: { id: true } } },
  });
  if (routes.length === 0) return 0;

  // Load blocks (both directions) that would hide this seller from any of
  // the candidate collectors, in one round trip.
  const collectorIds = routes.map((r) => r.collectorId);
  const blocks = await db.block.findMany({
    where: {
      OR: [
        { blockerId: { in: collectorIds }, blockedId: listing.sellerId },
        { blockerId: listing.sellerId, blockedId: { in: collectorIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedCollectors = new Set<string>();
  for (const b of blocks) {
    if (b.blockerId === listing.sellerId) blockedCollectors.add(b.blockedId);
    else blockedCollectors.add(b.blockerId);
  }

  // Look up rows this listing already has so a repeat fan-out is a quiet
  // no-op — SQLite has no upsert-by-createMany, and we want to avoid the
  // per-row unique-constraint error Prisma always logs when we catch it.
  const existing = await db.routeNotification.findMany({
    where: {
      listingId: listing.id,
      collectorId: { in: routes.map((r) => r.collectorId) },
    },
    select: { collectorId: true },
  });
  const alreadyNotified = new Set(existing.map((e) => e.collectorId));

  let written = 0;
  for (const row of routes) {
    if (blockedCollectors.has(row.collectorId)) continue;
    if (alreadyNotified.has(row.collectorId)) continue;
    const routeView = {
      originLatitude: row.originLatitude,
      originLongitude: row.originLongitude,
      destLatitude: row.destLatitude,
      destLongitude: row.destLongitude,
      maxDetourKm: row.maxDetourKm,
      acceptedMaterials: parseMaterials(row.acceptedMaterials),
      minQuantity: row.minQuantity,
      minQuantityUnit: row.minQuantityUnit,
    } as const;
    if (!routeMatchesListing(routeView, listing)) continue;

    const notif = await db.routeNotification.create({
      data: {
        collectorId: row.collectorId,
        routeId: row.id,
        listingId: listing.id,
      },
    });
    await recordEvent({
      type: "ROUTE_MATCH_NOTIFIED",
      channel: "ROUTE",
      actorId: row.collectorId,
      subjectType: "ROUTE_NOTIFICATION",
      subjectId: notif.id,
      material: listing.materialCategory,
      locality: listing.locality,
      metadata: { listingId: listing.id, routeId: row.id },
    });
    written += 1;
  }
  return written;
}

/**
 * Every route-match notification for this collector, most-recent first, with
 * the notified listing embedded. The unseen rows come first so the UI can
 * highlight them without a second query.
 */
export async function listNotificationsForCollector(
  collectorId: string,
): Promise<RouteNotificationDTO[]> {
  const rows = await db.routeNotification.findMany({
    where: { collectorId },
    orderBy: [{ seenAt: "asc" }, { createdAt: "desc" }],
    include: { listing: true },
  });
  return rows.map((r) => ({
    id: r.id,
    collectorId: r.collectorId,
    routeId: r.routeId,
    seenAt: r.seenAt,
    createdAt: r.createdAt,
    listing: listingToDTO(r.listing),
  }));
}

/**
 * Stamp `seenAt` on one notification row belonging to this collector. Refuses
 * to touch someone else's row.
 */
export async function markNotificationSeen(
  collectorId: string,
  notificationId: string,
): Promise<RouteNotification> {
  const row = await db.routeNotification.findUnique({
    where: { id: notificationId },
  });
  if (!row) throw new RouteNotificationError("not_found");
  if (row.collectorId !== collectorId) {
    throw new RouteNotificationError("forbidden");
  }
  if (row.seenAt) return row;
  return db.routeNotification.update({
    where: { id: notificationId },
    data: { seenAt: new Date() },
  });
}

/** Toggle the user's route-match notification preference. */
export async function setNotifyOnRouteMatch(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { notifyOnRouteMatch: enabled },
  });
}
