import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { createListing, pauseListing } from "@/lib/listings/listings";
import type { Role } from "@/lib/roles";
import { discoverNearby, distanceKm } from "@/lib/discovery/discovery";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: Role[] = ["HOUSEHOLD"]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

// A reference point in Bengaluru we use as the collector's search origin.
const KORAMANGALA = { latitude: 12.9352, longitude: 77.6245 };
// Roughly 3km north of Koramangala.
const INDIRANAGAR = { latitude: 12.9719, longitude: 77.6412 };
// Roughly 20km west of Koramangala.
const KENGERI = { latitude: 12.9081, longitude: 77.4826 };

const baseListing = {
  sellerType: "HOUSEHOLD" as const,
  title: "Clean PET bottles",
  photos: ["https://example.com/1.jpg"],
  quantityUnit: "KG" as const,
  locality: "Somewhere",
  availability: "WEEKENDS" as const,
};

async function seedListing(
  sellerId: string,
  overrides: Record<string, unknown> & {
    latitude: number;
    longitude: number;
  },
) {
  return createListing(sellerId, {
    ...baseListing,
    materialCategory: "PLASTIC",
    quantityMin: 5,
    quantityMax: 10,
    ...overrides,
  });
}

describe("distanceKm", () => {
  it("returns roughly 3km between Koramangala and Indiranagar", () => {
    const d = distanceKm(KORAMANGALA, INDIRANAGAR);
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(5);
  });

  it("returns 0 for the same point", () => {
    expect(distanceKm(KORAMANGALA, KORAMANGALA)).toBe(0);
  });
});

describe("discoverNearby", () => {
  it("returns other sellers' active listings sorted by distance", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    await seedListing(seller, { title: "Far", ...KENGERI });
    await seedListing(seller, { title: "Near", ...INDIRANAGAR });

    const results = await discoverNearby(viewer, { near: KORAMANGALA });

    expect(results.map((r) => r.title)).toEqual(["Near", "Far"]);
    expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
  });

  it("excludes the viewer's own listings", async () => {
    const viewer = await makeUser("+14155550100", ["HOUSEHOLD", "COLLECTOR"]);
    const other = await makeUser("+14155550200", ["HOUSEHOLD"]);

    await seedListing(viewer, { title: "Mine", ...INDIRANAGAR });
    await seedListing(other, { title: "Theirs", ...INDIRANAGAR });

    const results = await discoverNearby(viewer, { near: KORAMANGALA });
    expect(results.map((r) => r.title)).toEqual(["Theirs"]);
  });

  it("excludes non-ACTIVE listings", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    const active = await seedListing(seller, {
      title: "Active",
      ...INDIRANAGAR,
    });
    const paused = await seedListing(seller, {
      title: "Paused",
      ...INDIRANAGAR,
    });
    await pauseListing(seller, paused.id);

    const results = await discoverNearby(viewer, { near: KORAMANGALA });
    expect(results.map((r) => r.id)).toEqual([active.id]);
  });

  it("filters by material category", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    await seedListing(seller, {
      title: "Plastic",
      materialCategory: "PLASTIC",
      ...INDIRANAGAR,
    });
    await seedListing(seller, {
      title: "Paper",
      materialCategory: "PAPER",
      ...INDIRANAGAR,
    });

    const results = await discoverNearby(viewer, {
      near: KORAMANGALA,
      materialCategory: "PAPER",
    });
    expect(results.map((r) => r.title)).toEqual(["Paper"]);
  });

  it("filters by availability", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    await seedListing(seller, {
      title: "Weekends",
      availability: "WEEKENDS",
      ...INDIRANAGAR,
    });
    await seedListing(seller, {
      title: "Weekdays",
      availability: "WEEKDAYS",
      ...INDIRANAGAR,
    });

    const results = await discoverNearby(viewer, {
      near: KORAMANGALA,
      availability: "WEEKDAYS",
    });
    expect(results.map((r) => r.title)).toEqual(["Weekdays"]);
  });

  it("filters by minimum quantity in the matching unit", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    await seedListing(seller, {
      title: "Small",
      quantityMin: 1,
      quantityMax: 3,
      quantityUnit: "KG",
      ...INDIRANAGAR,
    });
    await seedListing(seller, {
      title: "Large",
      quantityMin: 8,
      quantityMax: 12,
      quantityUnit: "KG",
      ...INDIRANAGAR,
    });
    await seedListing(seller, {
      title: "Different unit",
      quantityMin: 20,
      quantityMax: 30,
      quantityUnit: "PIECES",
      ...INDIRANAGAR,
    });

    const results = await discoverNearby(viewer, {
      near: KORAMANGALA,
      minQuantity: 5,
      quantityUnit: "KG",
    });
    expect(results.map((r) => r.title)).toEqual(["Large"]);
  });

  it("rejects a minQuantity without a quantityUnit", async () => {
    const viewer = await makeUser("+14155550100", ["COLLECTOR"]);
    await expect(
      discoverNearby(viewer, { near: KORAMANGALA, minQuantity: 5 }),
    ).rejects.toThrow();
  });

  it("filters by maximum distance in km", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155550200", ["COLLECTOR"]);

    await seedListing(seller, { title: "Close", ...INDIRANAGAR });
    await seedListing(seller, { title: "Far", ...KENGERI });

    const results = await discoverNearby(viewer, {
      near: KORAMANGALA,
      maxDistanceKm: 10,
    });
    expect(results.map((r) => r.title)).toEqual(["Close"]);
  });

  it("rejects a negative or zero max distance", async () => {
    const viewer = await makeUser("+14155550100", ["COLLECTOR"]);
    await expect(
      discoverNearby(viewer, { near: KORAMANGALA, maxDistanceKm: 0 }),
    ).rejects.toThrow();
  });

  it("rejects an origin outside the valid lat/lng range", async () => {
    const viewer = await makeUser("+14155550100", ["COLLECTOR"]);
    await expect(
      discoverNearby(viewer, { near: { latitude: 999, longitude: 0 } }),
    ).rejects.toThrow();
  });
});
