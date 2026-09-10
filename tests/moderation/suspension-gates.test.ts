import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser, BlockError } from "@/lib/blocks/blocks";
import {
  ConnectionError,
  expressInterest,
  postMessage,
} from "@/lib/connections/connections";
import { discoverNearby } from "@/lib/discovery/discovery";
import {
  ListingError,
  createListing,
} from "@/lib/listings/listings";
import { ProfileError, updateProfileForUser } from "@/lib/profiles/profiles";
import { ReportError, reportUser } from "@/lib/reports/reports";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: string[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles as never);
  return user.id;
}

async function suspend(userId: string, reason = "test") {
  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspensionReason: reason },
  });
}

async function makeListing(sellerId: string, title = "Suspended seller listing") {
  return db.listing.create({
    data: {
      sellerId,
      sellerType: "HOUSEHOLD",
      materialCategory: "PLASTIC",
      title,
      photos: JSON.stringify(["https://x/1.jpg"]),
      quantityMin: 1,
      quantityMax: 2,
      quantityUnit: "KG",
      locality: "HSR",
      latitude: 12.9,
      longitude: 77.6,
      availability: "ANYTIME",
    },
  });
}

describe("suspension refuses writes across services", () => {
  it("createListing throws suspended for a suspended seller", async () => {
    const seller = await makeUser("+14155551200", ["HOUSEHOLD"]);
    await suspend(seller);
    await expect(
      createListing(seller, {
        sellerType: "HOUSEHOLD",
        materialCategory: "PLASTIC",
        title: "Nope",
        photos: ["https://x/1.jpg"],
        quantityMin: 1,
        quantityMax: 2,
        quantityUnit: "KG",
        locality: "HSR",
        latitude: 12.9,
        longitude: 77.6,
        availability: "ANYTIME",
      }),
    ).rejects.toMatchObject({ code: "suspended" } as ListingError);
  });

  it("expressInterest throws suspended for a suspended collector", async () => {
    const seller = await makeUser("+14155551210", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155551211", ["COLLECTOR"]);
    const listing = await makeListing(seller);
    await suspend(collector);
    await expect(
      expressInterest(collector, listing.id),
    ).rejects.toMatchObject({ code: "suspended" } as ConnectionError);
  });

  it("expressInterest treats a suspended seller's listing as inactive", async () => {
    const seller = await makeUser("+14155551220", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155551221", ["COLLECTOR"]);
    const listing = await makeListing(seller);
    await suspend(seller);
    await expect(
      expressInterest(collector, listing.id),
    ).rejects.toMatchObject({ code: "listing_not_active" });
  });

  it("blockUser throws suspended for a suspended caller", async () => {
    const blocker = await makeUser("+14155551230", ["HOUSEHOLD"]);
    const target = await makeUser("+14155551231", ["HOUSEHOLD"]);
    await suspend(blocker);
    await expect(blockUser(blocker, target)).rejects.toMatchObject({
      code: "suspended",
    } as BlockError);
  });

  it("reportUser throws suspended for a suspended reporter", async () => {
    const reporter = await makeUser("+14155551240", ["HOUSEHOLD"]);
    const target = await makeUser("+14155551241", ["HOUSEHOLD"]);
    await suspend(reporter);
    await expect(
      reportUser(reporter, target, { reason: "spam" }),
    ).rejects.toMatchObject({ code: "suspended" } as ReportError);
  });

  it("updateProfileForUser throws suspended for a suspended user", async () => {
    const user = await makeUser("+14155551250", ["HOUSEHOLD"]);
    await suspend(user);
    await expect(
      updateProfileForUser(user, { displayName: "Attempted rename" }),
    ).rejects.toMatchObject({ code: "suspended" } as ProfileError);
  });

  it("postMessage on a reserved connection throws suspended for a suspended sender", async () => {
    const seller = await makeUser("+14155551260", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155551261", ["COLLECTOR"]);
    const listing = await makeListing(seller);
    const connection = await db.connection.create({
      data: {
        listingId: listing.id,
        sellerId: seller,
        collectorId: collector,
        status: "RESERVED",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    await suspend(collector);
    await expect(
      postMessage(collector, connection.id, "hello"),
    ).rejects.toMatchObject({ code: "suspended" } as ConnectionError);
  });
});

describe("suspension hides sellers from discovery", () => {
  it("removes a suspended seller's active listings from nearby results", async () => {
    const seller = await makeUser("+14155551300", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155551301", ["COLLECTOR"]);
    await makeListing(seller, "Should disappear when suspended");

    const beforeResults = await discoverNearby(collector, {
      near: { latitude: 12.9, longitude: 77.6 },
      maxDistanceKm: 50,
    });
    expect(beforeResults.map((r) => r.sellerId)).toContain(seller);

    await suspend(seller);

    const afterResults = await discoverNearby(collector, {
      near: { latitude: 12.9, longitude: 77.6 },
      maxDistanceKm: 50,
    });
    expect(afterResults.map((r) => r.sellerId)).not.toContain(seller);
  });
});
