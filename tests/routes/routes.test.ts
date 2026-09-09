import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser } from "@/lib/blocks/blocks";
import {
  RouteError,
  endRoute,
  findMatchingListings,
  getActiveRouteForCollector,
  startRoute,
} from "@/lib/routes/routes";
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
    title: string;
    materialCategory: string;
    latitude: number;
    longitude: number;
    availability: string;
    status: string;
    quantityMax: number;
    quantityUnit: string;
  }> = {},
) {
  return db.listing.create({
    data: {
      sellerId,
      sellerType: "HOUSEHOLD",
      materialCategory: overrides.materialCategory ?? "PLASTIC",
      title: overrides.title ?? "Route match candidate",
      photos: JSON.stringify(["https://example.com/x.jpg"]),
      quantityMin: 1,
      quantityMax: overrides.quantityMax ?? 5,
      quantityUnit: overrides.quantityUnit ?? "KG",
      locality: "somewhere",
      latitude: overrides.latitude ?? 12.9,
      longitude: overrides.longitude ?? 77.6,
      availability: overrides.availability ?? "ANYTIME",
      status: overrides.status ?? "ACTIVE",
    },
  });
}

// A trip roughly HSR Layout -> Whitefield in Bengaluru; ~15km apart.
const ORIGIN = { latitude: 12.9110, longitude: 77.6470 };
const DEST = { latitude: 12.9698, longitude: 77.7500 };

function validRouteInput(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  return {
    originLatitude: ORIGIN.latitude,
    originLongitude: ORIGIN.longitude,
    destLatitude: DEST.latitude,
    destLongitude: DEST.longitude,
    departAt: new Date(now).toISOString(),
    arriveByAt: new Date(now + 60 * 60 * 1000).toISOString(),
    acceptedMaterials: [] as string[],
    maxDetourKm: 3,
    ...overrides,
  };
}

describe("startRoute", () => {
  it("creates an ACTIVE route for a collector-type user", async () => {
    const collector = await makeUser("+14155552000", ["COLLECTOR"]);
    const route = await startRoute(collector, validRouteInput());

    expect(route.id).toEqual(expect.any(String));
    expect(route.status).toBe("ACTIVE");
    expect(route.collectorId).toBe(collector);
    expect(route.maxDetourKm).toBe(3);
  });

  it("refuses to start when the user has no collector-type role", async () => {
    const seller = await makeUser("+14155552001", ["HOUSEHOLD"]);
    await expect(startRoute(seller, validRouteInput())).rejects.toMatchObject({
      code: "not_a_collector",
    } as RouteError);
  });

  it("refuses to start when the user is suspended", async () => {
    const collector = await makeUser("+14155552002", ["COLLECTOR"]);
    await db.user.update({
      where: { id: collector },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });
    await expect(startRoute(collector, validRouteInput())).rejects.toMatchObject({
      code: "suspended",
    } as RouteError);
  });

  it("ends any existing ACTIVE route before starting a new one", async () => {
    const collector = await makeUser("+14155552003", ["COLLECTOR"]);
    const first = await startRoute(collector, validRouteInput());
    const second = await startRoute(collector, validRouteInput());

    const reloadedFirst = await db.route.findUnique({ where: { id: first.id } });
    expect(reloadedFirst?.status).toBe("ENDED");
    expect(reloadedFirst?.endedAt).not.toBeNull();
    expect(second.status).toBe("ACTIVE");

    const active = await getActiveRouteForCollector(collector);
    expect(active?.id).toBe(second.id);
  });

  it("rejects an arriveByAt that is not after departAt", async () => {
    const collector = await makeUser("+14155552004", ["COLLECTOR"]);
    const t = new Date();
    await expect(
      startRoute(
        collector,
        validRouteInput({
          departAt: t.toISOString(),
          arriveByAt: t.toISOString(),
        }),
      ),
    ).rejects.toThrow(); // Zod validation error
  });
});

describe("endRoute", () => {
  it("stamps endedAt and moves status to ENDED", async () => {
    const collector = await makeUser("+14155552010", ["COLLECTOR"]);
    const route = await startRoute(collector, validRouteInput());

    await endRoute(collector, route.id);
    const reloaded = await db.route.findUnique({ where: { id: route.id } });
    expect(reloaded?.status).toBe("ENDED");
    expect(reloaded?.endedAt).not.toBeNull();
  });

  it("refuses to end someone else's route", async () => {
    const owner = await makeUser("+14155552011", ["COLLECTOR"]);
    const stranger = await makeUser("+14155552012", ["COLLECTOR"]);
    const route = await startRoute(owner, validRouteInput());
    await expect(endRoute(stranger, route.id)).rejects.toMatchObject({
      code: "forbidden",
    } as RouteError);
  });

  it("refuses when the route does not exist", async () => {
    const collector = await makeUser("+14155552013", ["COLLECTOR"]);
    await expect(endRoute(collector, "does-not-exist")).rejects.toMatchObject({
      code: "not_found",
    } as RouteError);
  });
});

describe("findMatchingListings", () => {
  it("returns listings within maxDetourKm ranked by ascending detour", async () => {
    const collector = await makeUser("+14155552100", ["COLLECTOR"]);
    const nearMidpointSeller = await makeUser("+14155552101", ["HOUSEHOLD"]);
    const farSeller = await makeUser("+14155552102", ["HOUSEHOLD"]);
    const wayFarSeller = await makeUser("+14155552103", ["HOUSEHOLD"]);

    // Along-route candidate (near midpoint between ORIGIN and DEST).
    const alongRoute = await makeListing(nearMidpointSeller, {
      title: "Along the route",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    // A small detour candidate — a few km off the line.
    const smallDetour = await makeListing(farSeller, {
      title: "Small detour",
      latitude: 12.9550,
      longitude: 77.7100,
    });
    // Very far off-route — should be excluded by the maxDetourKm filter.
    await makeListing(wayFarSeller, {
      title: "Way off route",
      latitude: 13.1000,
      longitude: 77.9500,
    });

    const route = await startRoute(
      collector,
      validRouteInput({ maxDetourKm: 5 }),
    );

    const matches = await findMatchingListings(collector, route.id);
    const titles = matches.map((m) => m.title);
    expect(titles).toContain("Along the route");
    expect(titles).toContain("Small detour");
    expect(titles).not.toContain("Way off route");

    // Ranked ascending by detour distance.
    const alongIdx = titles.indexOf("Along the route");
    const detourIdx = titles.indexOf("Small detour");
    expect(alongIdx).toBeLessThan(detourIdx);
    expect(matches.find((m) => m.id === alongRoute.id)!.detourKm).toBeLessThan(
      matches.find((m) => m.id === smallDetour.id)!.detourKm,
    );
  });

  it("filters by acceptedMaterials when set", async () => {
    const collector = await makeUser("+14155552110", ["COLLECTOR"]);
    const seller = await makeUser("+14155552111", ["HOUSEHOLD"]);

    await makeListing(seller, {
      title: "Plastic bottles",
      materialCategory: "PLASTIC",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(seller, {
      title: "Paper stacks",
      materialCategory: "PAPER",
      latitude: 12.9404,
      longitude: 77.6985,
    });

    const route = await startRoute(
      collector,
      validRouteInput({ acceptedMaterials: ["PAPER"], maxDetourKm: 5 }),
    );

    const matches = await findMatchingListings(collector, route.id);
    expect(matches.map((m) => m.title)).toEqual(["Paper stacks"]);
  });

  it("filters by minQuantity + quantityUnit when set", async () => {
    const collector = await makeUser("+14155552120", ["COLLECTOR"]);
    const seller = await makeUser("+14155552121", ["HOUSEHOLD"]);

    await makeListing(seller, {
      title: "Small lot",
      quantityMax: 2,
      quantityUnit: "KG",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(seller, {
      title: "Big lot",
      quantityMax: 50,
      quantityUnit: "KG",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(seller, {
      title: "Wrong unit",
      quantityMax: 200,
      quantityUnit: "PIECES",
      latitude: 12.9404,
      longitude: 77.6985,
    });

    const route = await startRoute(
      collector,
      validRouteInput({
        maxDetourKm: 5,
        minQuantity: 10,
        minQuantityUnit: "KG",
      }),
    );

    const matches = await findMatchingListings(collector, route.id);
    expect(matches.map((m) => m.title)).toEqual(["Big lot"]);
  });

  it("excludes PAUSED and CLOSED listings, and listings from suspended sellers", async () => {
    const collector = await makeUser("+14155552130", ["COLLECTOR"]);
    const activeSeller = await makeUser("+14155552131", ["HOUSEHOLD"]);
    const pausedSeller = await makeUser("+14155552132", ["HOUSEHOLD"]);
    const suspendedSeller = await makeUser("+14155552133", ["HOUSEHOLD"]);

    await makeListing(activeSeller, {
      title: "Active",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(pausedSeller, {
      title: "Paused",
      status: "PAUSED",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(suspendedSeller, {
      title: "Owned by suspended user",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await db.user.update({
      where: { id: suspendedSeller },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });

    const route = await startRoute(
      collector,
      validRouteInput({ maxDetourKm: 5 }),
    );

    const matches = await findMatchingListings(collector, route.id);
    expect(matches.map((m) => m.title)).toEqual(["Active"]);
  });

  it("excludes listings from either side of a block", async () => {
    const collector = await makeUser("+14155552140", ["COLLECTOR"]);
    const blockedSeller = await makeUser("+14155552141", ["HOUSEHOLD"]);
    const blockerSeller = await makeUser("+14155552142", ["HOUSEHOLD"]);

    await makeListing(blockedSeller, {
      title: "Blocked by me",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await makeListing(blockerSeller, {
      title: "Blocked me",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await blockUser(collector, blockedSeller);
    await blockUser(blockerSeller, collector);

    const route = await startRoute(
      collector,
      validRouteInput({ maxDetourKm: 5 }),
    );
    const matches = await findMatchingListings(collector, route.id);
    expect(matches.map((m) => m.title)).toEqual([]);
  });

  it("excludes listings already held by an active reservation", async () => {
    const collector = await makeUser("+14155552145", ["COLLECTOR"]);
    const seller = await makeUser("+14155552146", ["HOUSEHOLD"]);
    const otherBuyer = await makeUser("+14155552147", ["COLLECTOR"]);

    const listing = await makeListing(seller, {
      title: "Already reserved",
      latitude: 12.9404,
      longitude: 77.6985,
    });
    await db.connection.create({
      data: {
        listingId: listing.id,
        sellerId: seller,
        collectorId: otherBuyer,
        status: "RESERVED",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    const route = await startRoute(
      collector,
      validRouteInput({ maxDetourKm: 5 }),
    );
    const matches = await findMatchingListings(collector, route.id);
    expect(matches.map((m) => m.title)).toEqual([]);
  });

  it("excludes the collector's own listings", async () => {
    const collector = await makeUser("+14155552150", ["COLLECTOR", "HOUSEHOLD"]);
    await makeListing(collector, {
      title: "Mine",
      latitude: 12.9404,
      longitude: 77.6985,
    });

    const route = await startRoute(
      collector,
      validRouteInput({ maxDetourKm: 5 }),
    );
    const matches = await findMatchingListings(collector, route.id);
    expect(matches).toEqual([]);
  });

  it("refuses to return matches for someone else's route", async () => {
    const owner = await makeUser("+14155552160", ["COLLECTOR"]);
    const stranger = await makeUser("+14155552161", ["COLLECTOR"]);
    const route = await startRoute(owner, validRouteInput());
    await expect(
      findMatchingListings(stranger, route.id),
    ).rejects.toMatchObject({ code: "forbidden" } as RouteError);
  });

  it("refuses when the route has ENDED", async () => {
    const collector = await makeUser("+14155552170", ["COLLECTOR"]);
    const route = await startRoute(collector, validRouteInput());
    await endRoute(collector, route.id);
    await expect(
      findMatchingListings(collector, route.id),
    ).rejects.toMatchObject({ code: "not_active" } as RouteError);
  });
});
