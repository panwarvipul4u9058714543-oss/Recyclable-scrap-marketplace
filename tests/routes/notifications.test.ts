import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser } from "@/lib/blocks/blocks";
import {
  fanOutForNewListing,
  listNotificationsForCollector,
  markNotificationSeen,
  setNotifyOnRouteMatch,
  RouteNotificationError,
} from "@/lib/routes/notifications";
import { endRoute, startRoute } from "@/lib/routes/routes";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: string[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles as never);
  return user.id;
}

async function makeListing(
  sellerId: string,
  overrides: Partial<{
    materialCategory: string;
    latitude: number;
    longitude: number;
    quantityMax: number;
    quantityUnit: string;
    status: string;
    title: string;
  }> = {},
) {
  return db.listing.create({
    data: {
      sellerId,
      sellerType: "HOUSEHOLD",
      materialCategory: overrides.materialCategory ?? "PLASTIC",
      title: overrides.title ?? "Notify me",
      photos: JSON.stringify(["https://x/1.jpg"]),
      quantityMin: 1,
      quantityMax: overrides.quantityMax ?? 5,
      quantityUnit: overrides.quantityUnit ?? "KG",
      locality: "HSR",
      latitude: overrides.latitude ?? 12.9404,
      longitude: overrides.longitude ?? 77.6985,
      availability: "ANYTIME",
      status: overrides.status ?? "ACTIVE",
    },
  });
}

// Same HSR→Whitefield trip used elsewhere.
const ORIGIN = { latitude: 12.911, longitude: 77.647 };
const DEST = { latitude: 12.9698, longitude: 77.75 };

function routeInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    originLatitude: ORIGIN.latitude,
    originLongitude: ORIGIN.longitude,
    destLatitude: DEST.latitude,
    destLongitude: DEST.longitude,
    departAt: new Date().toISOString(),
    arriveByAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    acceptedMaterials: [] as string[],
    maxDetourKm: 5,
    ...overrides,
  };
}

describe("fanOutForNewListing", () => {
  it("creates a notification for every ACTIVE route the new listing matches", async () => {
    const seller = await makeUser("+14155553000", ["HOUSEHOLD"]);
    const alice = await makeUser("+14155553001", ["COLLECTOR"]);
    const bob = await makeUser("+14155553002", ["COLLECTOR"]);
    await startRoute(alice, routeInput());
    await startRoute(bob, routeInput());

    const listing = await makeListing(seller);
    const written = await fanOutForNewListing(listing.id);

    expect(written).toBe(2);
    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((r) => r.collectorId).sort()).toEqual([alice, bob].sort());
    expect(rows.every((r) => r.seenAt === null)).toBe(true);
  });

  it("skips collectors whose acceptedMaterials do not include the listing's material", async () => {
    const seller = await makeUser("+14155553010", ["HOUSEHOLD"]);
    const wantsPaper = await makeUser("+14155553011", ["COLLECTOR"]);
    const wantsAny = await makeUser("+14155553012", ["COLLECTOR"]);
    await startRoute(wantsPaper, routeInput({ acceptedMaterials: ["PAPER"] }));
    await startRoute(wantsAny, routeInput());

    const listing = await makeListing(seller, { materialCategory: "PLASTIC" });
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows.map((r) => r.collectorId)).toEqual([wantsAny]);
  });

  it("skips collectors whose minQuantity+unit is not met", async () => {
    const seller = await makeUser("+14155553020", ["HOUSEHOLD"]);
    const bigOnly = await makeUser("+14155553021", ["COLLECTOR"]);
    const wrongUnit = await makeUser("+14155553022", ["COLLECTOR"]);
    const anySize = await makeUser("+14155553023", ["COLLECTOR"]);

    await startRoute(
      bigOnly,
      routeInput({ minQuantity: 20, minQuantityUnit: "KG" }),
    );
    await startRoute(
      wrongUnit,
      routeInput({ minQuantity: 1, minQuantityUnit: "PIECES" }),
    );
    await startRoute(anySize, routeInput());

    const listing = await makeListing(seller, {
      quantityMax: 5,
      quantityUnit: "KG",
    });
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows.map((r) => r.collectorId)).toEqual([anySize]);
  });

  it("skips collectors whose detour would exceed their maxDetourKm", async () => {
    const seller = await makeUser("+14155553030", ["HOUSEHOLD"]);
    const tight = await makeUser("+14155553031", ["COLLECTOR"]);
    const loose = await makeUser("+14155553032", ["COLLECTOR"]);

    await startRoute(tight, routeInput({ maxDetourKm: 0.5 }));
    await startRoute(loose, routeInput({ maxDetourKm: 20 }));

    // Push the listing far enough off-route that tight cannot reach it but
    // loose still can.
    const listing = await makeListing(seller, {
      latitude: 12.98,
      longitude: 77.72,
    });
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows.map((r) => r.collectorId)).toEqual([loose]);
  });

  it("skips collectors who have opted out of route-match notifications", async () => {
    const seller = await makeUser("+14155553040", ["HOUSEHOLD"]);
    const optedOut = await makeUser("+14155553041", ["COLLECTOR"]);
    const optedIn = await makeUser("+14155553042", ["COLLECTOR"]);
    await startRoute(optedOut, routeInput());
    await startRoute(optedIn, routeInput());
    await setNotifyOnRouteMatch(optedOut, false);

    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows.map((r) => r.collectorId)).toEqual([optedIn]);
  });

  it("skips routes that are ENDED", async () => {
    const seller = await makeUser("+14155553050", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553051", ["COLLECTOR"]);
    const route = await startRoute(collector, routeInput());
    await endRoute(collector, route.id);

    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows).toEqual([]);
  });

  it("skips when either side of a block would hide the seller from the collector", async () => {
    const seller = await makeUser("+14155553060", ["HOUSEHOLD"]);
    const blocker = await makeUser("+14155553061", ["COLLECTOR"]);
    const blocked = await makeUser("+14155553062", ["COLLECTOR"]);
    await startRoute(blocker, routeInput());
    await startRoute(blocked, routeInput());
    await blockUser(blocker, seller);
    await blockUser(seller, blocked);

    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows).toEqual([]);
  });

  it("skips a suspended collector's route", async () => {
    const seller = await makeUser("+14155553070", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553071", ["COLLECTOR"]);
    await startRoute(collector, routeInput());
    await db.user.update({
      where: { id: collector },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });

    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows).toEqual([]);
  });

  it("never notifies the collector about their own listing", async () => {
    const collectorSeller = await makeUser("+14155553080", [
      "COLLECTOR",
      "HOUSEHOLD",
    ]);
    await startRoute(collectorSeller, routeInput());

    const listing = await makeListing(collectorSeller);
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows).toEqual([]);
  });

  it("does not create a duplicate row when the fan-out runs twice for the same listing", async () => {
    const seller = await makeUser("+14155553090", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553091", ["COLLECTOR"]);
    await startRoute(collector, routeInput());

    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);
    const secondWrite = await fanOutForNewListing(listing.id);

    expect(secondWrite).toBe(0);
    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows.length).toBe(1);
  });

  it("does nothing when the listing is not ACTIVE", async () => {
    const seller = await makeUser("+14155553100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553101", ["COLLECTOR"]);
    await startRoute(collector, routeInput());

    const listing = await makeListing(seller, { status: "PAUSED" });
    await fanOutForNewListing(listing.id);

    const rows = await db.routeNotification.findMany({
      where: { listingId: listing.id },
    });
    expect(rows).toEqual([]);
  });
});

describe("listNotificationsForCollector + markNotificationSeen", () => {
  it("lists unseen matches first, most recent first, with listing details", async () => {
    const seller = await makeUser("+14155553200", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553201", ["COLLECTOR"]);
    await startRoute(collector, routeInput());
    const a = await makeListing(seller, { title: "First match" });
    await fanOutForNewListing(a.id);
    // Different listing → different row (unique key allows a second row).
    const b = await makeListing(seller, { title: "Second match" });
    await fanOutForNewListing(b.id);

    const list = await listNotificationsForCollector(collector);
    expect(list.map((n) => n.listing.title)).toEqual([
      "Second match",
      "First match",
    ]);
    expect(list.every((n) => n.seenAt === null)).toBe(true);
  });

  it("markNotificationSeen stamps seenAt on the caller's own row", async () => {
    const seller = await makeUser("+14155553210", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155553211", ["COLLECTOR"]);
    await startRoute(collector, routeInput());
    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);

    const [notification] = await listNotificationsForCollector(collector);
    await markNotificationSeen(collector, notification.id);

    const reloaded = await db.routeNotification.findUnique({
      where: { id: notification.id },
    });
    expect(reloaded?.seenAt).not.toBeNull();
  });

  it("markNotificationSeen refuses another user's notification", async () => {
    const seller = await makeUser("+14155553220", ["HOUSEHOLD"]);
    const owner = await makeUser("+14155553221", ["COLLECTOR"]);
    const stranger = await makeUser("+14155553222", ["COLLECTOR"]);
    await startRoute(owner, routeInput());
    const listing = await makeListing(seller);
    await fanOutForNewListing(listing.id);
    const [notification] = await listNotificationsForCollector(owner);

    await expect(
      markNotificationSeen(stranger, notification.id),
    ).rejects.toMatchObject({
      code: "forbidden",
    } as RouteNotificationError);
  });
});

describe("setNotifyOnRouteMatch", () => {
  it("toggles the flag on the user row", async () => {
    const collector = await makeUser("+14155553300", ["COLLECTOR"]);
    await setNotifyOnRouteMatch(collector, false);
    expect(
      (await db.user.findUnique({ where: { id: collector } }))?.notifyOnRouteMatch,
    ).toBe(false);
    await setNotifyOnRouteMatch(collector, true);
    expect(
      (await db.user.findUnique({ where: { id: collector } }))?.notifyOnRouteMatch,
    ).toBe(true);
  });
});
