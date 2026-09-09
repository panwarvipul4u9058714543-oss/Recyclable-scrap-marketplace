import type { Route } from "@prisma/client";
import { z } from "zod";
import { listBlockedByIds, listBlockedIds } from "@/lib/blocks/blocks";
import { listingIdsWithActiveReservation } from "@/lib/connections/connections";
import { db } from "@/lib/db";
import { distanceKm } from "@/lib/discovery/discovery";
import {
  type ListingDTO,
  listingToDTO,
} from "@/lib/listings/listings";
import {
  materialCategorySchema,
  quantityUnitSchema,
} from "@/lib/materials";
import { isUserSuspended } from "@/lib/moderation/moderation";
import { COLLECTOR_ROLES, type Role } from "@/lib/roles";

/**
 * Route mode lets a collector-type user (kabadiwala, dealer or recycler)
 * declare a trip they are already making and see marketplace listings that
 * fit within an acceptable detour. The route row is submit-once and reviewed
 * later — nothing here streams live matches while the collector is driving.
 */

export type RouteErrorCode =
  | "not_found"
  | "forbidden"
  | "not_a_collector"
  | "suspended"
  | "not_active";

export class RouteError extends Error {
  constructor(public readonly code: RouteErrorCode) {
    super(code);
    this.name = "RouteError";
  }
}

export const ROUTE_STATUSES = ["ACTIVE", "ENDED"] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export interface RouteDTO {
  id: string;
  collectorId: string;
  originLatitude: number;
  originLongitude: number;
  destLatitude: number;
  destLongitude: number;
  departAt: Date;
  arriveByAt: Date;
  acceptedMaterials: string[];
  maxDetourKm: number;
  minQuantity: number | null;
  minQuantityUnit: string | null;
  status: RouteStatus;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A listing that fits along the collector's route, with its practical detour. */
export interface RouteMatch extends ListingDTO {
  detourKm: number;
}

const isoDate = z.preprocess(
  (v) => (typeof v === "string" || v instanceof Date ? new Date(v) : v),
  z.date(),
);

export const startRouteSchema = z
  .object({
    originLatitude: z.number().gte(-90).lte(90),
    originLongitude: z.number().gte(-180).lte(180),
    destLatitude: z.number().gte(-90).lte(90),
    destLongitude: z.number().gte(-180).lte(180),
    departAt: isoDate,
    arriveByAt: isoDate,
    acceptedMaterials: z.array(materialCategorySchema).default([]),
    maxDetourKm: z.number().positive().max(50),
    minQuantity: z.number().positive().optional(),
    minQuantityUnit: quantityUnitSchema.optional(),
  })
  .refine((v) => v.arriveByAt.getTime() > v.departAt.getTime(), {
    message: "arriveByAt must be after departAt",
    path: ["arriveByAt"],
  })
  .refine(
    (v) => v.minQuantity === undefined || v.minQuantityUnit !== undefined,
    {
      message: "minQuantityUnit is required when minQuantity is set",
      path: ["minQuantityUnit"],
    },
  );

export type StartRouteInput = z.infer<typeof startRouteSchema>;

function parseMaterials(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function routeToDTO(row: Route): RouteDTO {
  return {
    id: row.id,
    collectorId: row.collectorId,
    originLatitude: row.originLatitude,
    originLongitude: row.originLongitude,
    destLatitude: row.destLatitude,
    destLongitude: row.destLongitude,
    departAt: row.departAt,
    arriveByAt: row.arriveByAt,
    acceptedMaterials: parseMaterials(row.acceptedMaterials),
    maxDetourKm: row.maxDetourKm,
    minQuantity: row.minQuantity,
    minQuantityUnit: row.minQuantityUnit,
    status: row.status as RouteStatus,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertCollectorRole(collectorId: string) {
  const roles = await db.userRole.findMany({
    where: { userId: collectorId },
    select: { role: true },
  });
  const held = roles.map((r) => r.role as Role);
  const hasCollectorRole = held.some((r) =>
    (COLLECTOR_ROLES as readonly Role[]).includes(r),
  );
  if (!hasCollectorRole) throw new RouteError("not_a_collector");
}

/**
 * Start (or replace) the caller's active route. Ending any existing ACTIVE
 * route keeps the invariant that at most one route per collector is ACTIVE
 * at a time — the user is on exactly one trip.
 */
export async function startRoute(
  collectorId: string,
  input: unknown,
): Promise<RouteDTO> {
  if (await isUserSuspended(collectorId)) throw new RouteError("suspended");
  await assertCollectorRole(collectorId);
  const data = startRouteSchema.parse(input);

  await db.route.updateMany({
    where: { collectorId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });

  const row = await db.route.create({
    data: {
      collectorId,
      originLatitude: data.originLatitude,
      originLongitude: data.originLongitude,
      destLatitude: data.destLatitude,
      destLongitude: data.destLongitude,
      departAt: data.departAt,
      arriveByAt: data.arriveByAt,
      acceptedMaterials: JSON.stringify(data.acceptedMaterials),
      maxDetourKm: data.maxDetourKm,
      minQuantity: data.minQuantity ?? null,
      minQuantityUnit: data.minQuantityUnit ?? null,
    },
  });

  return routeToDTO(row);
}

export async function endRoute(
  collectorId: string,
  routeId: string,
): Promise<RouteDTO> {
  const row = await db.route.findUnique({ where: { id: routeId } });
  if (!row) throw new RouteError("not_found");
  if (row.collectorId !== collectorId) throw new RouteError("forbidden");
  if (row.status === "ENDED") return routeToDTO(row);

  const updated = await db.route.update({
    where: { id: routeId },
    data: { status: "ENDED", endedAt: new Date() },
  });
  return routeToDTO(updated);
}

export async function getActiveRouteForCollector(
  collectorId: string,
): Promise<RouteDTO | null> {
  const row = await db.route.findFirst({
    where: { collectorId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return row ? routeToDTO(row) : null;
}

/**
 * Practical detour: how many extra kilometres this listing adds to the trip.
 * detour = distance(origin, listing) + distance(listing, dest) - distance(origin, dest)
 * Clamped to 0 to guard against tiny negative rounding errors when the
 * listing sits exactly on the straight line.
 */
export function detourKmFor(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
  listing: { latitude: number; longitude: number },
): number {
  const via =
    distanceKm(origin, listing) + distanceKm(listing, dest);
  const direct = distanceKm(origin, dest);
  return Math.max(0, via - direct);
}

/**
 * Return listings that match the collector's active route, ranked by
 * ascending detour. Applies the same visibility rules as `discoverNearby`:
 * ACTIVE only, not from a suspended seller, not from either side of a block,
 * not the collector's own listings.
 */
export async function findMatchingListings(
  collectorId: string,
  routeId: string,
): Promise<RouteMatch[]> {
  const row = await db.route.findUnique({ where: { id: routeId } });
  if (!row) throw new RouteError("not_found");
  if (row.collectorId !== collectorId) throw new RouteError("forbidden");
  if (row.status !== "ACTIVE") throw new RouteError("not_active");

  const route = routeToDTO(row);
  const origin = {
    latitude: route.originLatitude,
    longitude: route.originLongitude,
  };
  const dest = {
    latitude: route.destLatitude,
    longitude: route.destLongitude,
  };

  const [blockedByViewer, blockedByOthers] = await Promise.all([
    listBlockedIds(collectorId),
    listBlockedByIds(collectorId),
  ]);
  const hiddenSellerIds = Array.from(
    new Set([collectorId, ...blockedByViewer, ...blockedByOthers]),
  );

  const listings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      sellerId: { notIn: hiddenSellerIds },
      seller: { suspendedAt: null },
      ...(route.acceptedMaterials.length > 0
        ? { materialCategory: { in: route.acceptedMaterials } }
        : {}),
      ...(route.minQuantity !== null && route.minQuantityUnit !== null
        ? {
            quantityUnit: route.minQuantityUnit,
            quantityMax: { gte: route.minQuantity },
          }
        : {}),
    },
  });

  // A listing already reserved for another buyer is not actionable — hide it
  // for the same reason `discoverNearby` does.
  const reserved = await listingIdsWithActiveReservation(
    listings.map((l) => l.id),
  );
  const visible = listings.filter((l) => !reserved.has(l.id));

  const withDetour = visible
    .map((l) => ({
      dto: listingToDTO(l),
      detourKm: detourKmFor(origin, dest, {
        latitude: l.latitude,
        longitude: l.longitude,
      }),
    }))
    .filter(({ detourKm }) => detourKm <= route.maxDetourKm)
    .sort((a, b) => a.detourKm - b.detourKm);

  return withDetour.map(({ dto, detourKm }) => ({ ...dto, detourKm }));
}
