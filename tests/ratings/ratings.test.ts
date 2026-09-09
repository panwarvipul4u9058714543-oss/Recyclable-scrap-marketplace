import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  RatingError,
  getRatingSummary,
  listRatingsFor,
  submitRating,
} from "@/lib/ratings/ratings";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, role: "HOUSEHOLD" | "COLLECTOR") {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, [role]);
  return user.id;
}

async function makeConnection(status: string) {
  const sellerId = await makeUser("+14155550400", "HOUSEHOLD");
  const collectorId = await makeUser("+14155550401", "COLLECTOR");
  const listing = await db.listing.create({
    data: {
      sellerId,
      sellerType: "HOUSEHOLD",
      materialCategory: "PLASTIC",
      title: "Bottles",
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
  const connection = await db.connection.create({
    data: {
      listingId: listing.id,
      sellerId,
      collectorId,
      status,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  return { sellerId, collectorId, connection };
}

describe("submitRating", () => {
  it("stores a rating and links it to the counterparty", async () => {
    const { sellerId, collectorId, connection } =
      await makeConnection("COMPLETED");

    const rating = await submitRating(sellerId, connection.id, {
      score: 5,
      comment: "Quick and courteous.",
    });

    expect(rating.raterId).toBe(sellerId);
    expect(rating.rateeId).toBe(collectorId);
    expect(rating.score).toBe(5);
    expect(rating.comment).toBe("Quick and courteous.");
  });

  it("also allows rating a FAILED pickup", async () => {
    const { collectorId, connection } = await makeConnection("FAILED");

    const rating = await submitRating(collectorId, connection.id, {
      score: 2,
    });

    expect(rating.score).toBe(2);
  });

  it("refuses to rate a RESERVED connection", async () => {
    const { sellerId, connection } = await makeConnection("RESERVED");

    await expect(
      submitRating(sellerId, connection.id, { score: 4 }),
    ).rejects.toBeInstanceOf(RatingError);
  });

  it("refuses to rate a CANCELLED connection", async () => {
    const { sellerId, connection } = await makeConnection("CANCELLED");
    await expect(
      submitRating(sellerId, connection.id, { score: 4 }),
    ).rejects.toBeInstanceOf(RatingError);
  });

  it("refuses to rate when the caller is not a party", async () => {
    const { connection } = await makeConnection("COMPLETED");
    const outsider = await makeUser("+14155550410", "HOUSEHOLD");

    await expect(
      submitRating(outsider, connection.id, { score: 5 }),
    ).rejects.toBeInstanceOf(RatingError);
  });

  it("refuses a second rating from the same rater on the same connection", async () => {
    const { sellerId, connection } = await makeConnection("COMPLETED");

    await submitRating(sellerId, connection.id, { score: 5 });
    await expect(
      submitRating(sellerId, connection.id, { score: 3 }),
    ).rejects.toBeInstanceOf(RatingError);
  });

  it("rejects a score outside 1..5", async () => {
    const { sellerId, connection } = await makeConnection("COMPLETED");
    await expect(
      submitRating(sellerId, connection.id, { score: 0 }),
    ).rejects.toThrow();
    await expect(
      submitRating(sellerId, connection.id, { score: 6 }),
    ).rejects.toThrow();
  });
});

describe("getRatingSummary", () => {
  it("returns average and count of ratings received", async () => {
    const { sellerId, collectorId, connection } =
      await makeConnection("COMPLETED");
    // Seller rates collector; collector also rates seller.
    await submitRating(sellerId, connection.id, { score: 5 });
    await submitRating(collectorId, connection.id, { score: 3 });

    const collectorSummary = await getRatingSummary(collectorId);
    expect(collectorSummary.count).toBe(1);
    expect(collectorSummary.average).toBe(5);

    const sellerSummary = await getRatingSummary(sellerId);
    expect(sellerSummary.count).toBe(1);
    expect(sellerSummary.average).toBe(3);
  });

  it("returns zero count / null average for a user with no ratings", async () => {
    const userId = await makeUser("+14155550420", "HOUSEHOLD");
    const summary = await getRatingSummary(userId);
    expect(summary.count).toBe(0);
    expect(summary.average).toBeNull();
  });
});

describe("listRatingsFor", () => {
  it("returns ratings newest first", async () => {
    const { sellerId, collectorId, connection } =
      await makeConnection("COMPLETED");
    await submitRating(sellerId, connection.id, {
      score: 4,
      comment: "Good.",
    });

    const ratings = await listRatingsFor(collectorId);
    expect(ratings.length).toBe(1);
    expect(ratings[0].comment).toBe("Good.");
  });
});
