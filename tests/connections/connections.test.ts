import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  ConnectionError,
  expressInterest,
  listCollectorConnections,
  listListingInterests,
  listSellerConnections,
  selectBuyer,
  withdrawInterest,
} from "@/lib/connections/connections";
import {
  closeListing,
  createListing,
  pauseListing,
} from "@/lib/listings/listings";
import type { Role } from "@/lib/roles";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: Role[] = ["HOUSEHOLD"]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

async function seedListing(sellerId: string) {
  return createListing(sellerId, {
    sellerType: "HOUSEHOLD" as const,
    materialCategory: "PLASTIC" as const,
    title: "Clean PET bottles",
    photos: ["https://example.com/1.jpg"],
    quantityMin: 5,
    quantityMax: 10,
    quantityUnit: "KG" as const,
    locality: "Koramangala",
    latitude: 12.9352,
    longitude: 77.6245,
    availability: "WEEKENDS" as const,
  });
}

describe("expressInterest", () => {
  it("records a collector's interest in an active listing", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    const interest = await expressInterest(collector, listing.id);

    expect(interest.listingId).toBe(listing.id);
    expect(interest.collectorId).toBe(collector);
  });

  it("is idempotent — a second expression returns the existing row", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    const first = await expressInterest(collector, listing.id);
    const second = await expressInterest(collector, listing.id);

    expect(second.id).toBe(first.id);
  });

  it("rejects a seller expressing interest in their own listing", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD", "COLLECTOR"]);
    const listing = await seedListing(seller);

    await expect(expressInterest(seller, listing.id)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects a non-collector user (no collector-type role)", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const other = await makeUser("+14155550200", ["HOUSEHOLD"]);
    const listing = await seedListing(seller);

    await expect(expressInterest(other, listing.id)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects an interest on a non-ACTIVE listing", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await pauseListing(seller, listing.id);

    await expect(expressInterest(collector, listing.id)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects an interest on an unknown listing", async () => {
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    await expect(expressInterest(collector, "no-such-id")).rejects.toThrow(
      ConnectionError,
    );
  });
});

describe("withdrawInterest", () => {
  it("removes the collector's interest", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    await expressInterest(collector, listing.id);
    await withdrawInterest(collector, listing.id);

    const interests = await listListingInterests(seller, listing.id);
    expect(interests).toEqual([]);
  });

  it("is a no-op if the collector never expressed interest", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    await expect(
      withdrawInterest(collector, listing.id),
    ).resolves.toBeUndefined();
  });
});

describe("listListingInterests", () => {
  it("returns interests for the seller's own listing, newest first", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const first = await makeUser("+14155550200", ["COLLECTOR"]);
    const second = await makeUser("+14155550300", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    await expressInterest(first, listing.id);
    await new Promise((r) => setTimeout(r, 5));
    await expressInterest(second, listing.id);

    const interests = await listListingInterests(seller, listing.id);
    expect(interests.map((i) => i.collectorId)).toEqual([second, first]);
    expect(interests[0].collectorPhone).toBeTruthy();
  });

  it("refuses to reveal interests to a non-owner", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const outsider = await makeUser("+14155550300", ["HOUSEHOLD"]);
    const listing = await seedListing(seller);

    await expressInterest(collector, listing.id);

    await expect(
      listListingInterests(outsider, listing.id),
    ).rejects.toThrow(ConnectionError);
  });
});

describe("selectBuyer", () => {
  it("creates a SELECTED connection for the chosen collector", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);

    const connection = await selectBuyer(seller, listing.id, collector);

    expect(connection.status).toBe("SELECTED");
    expect(connection.listingId).toBe(listing.id);
    expect(connection.collectorId).toBe(collector);
    expect(connection.sellerId).toBe(seller);
  });

  it("rejects selection by a non-owner", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const outsider = await makeUser("+14155550300", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);

    await expect(
      selectBuyer(outsider, listing.id, collector),
    ).rejects.toThrow(ConnectionError);
  });

  it("rejects selecting a collector who never expressed interest", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    await expect(
      selectBuyer(seller, listing.id, collector),
    ).rejects.toThrow(ConnectionError);
  });

  it("rejects a second selection while one is still open", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const alice = await makeUser("+14155550200", ["COLLECTOR"]);
    const bob = await makeUser("+14155550300", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(alice, listing.id);
    await expressInterest(bob, listing.id);

    await selectBuyer(seller, listing.id, alice);

    await expect(selectBuyer(seller, listing.id, bob)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects selection on a non-ACTIVE listing", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    await closeListing(seller, listing.id);

    await expect(
      selectBuyer(seller, listing.id, collector),
    ).rejects.toThrow(ConnectionError);
  });
});

describe("listSellerConnections / listCollectorConnections", () => {
  it("shows the connection from both sides", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const connection = await selectBuyer(seller, listing.id, collector);

    const asSeller = await listSellerConnections(seller);
    const asCollector = await listCollectorConnections(collector);

    expect(asSeller.map((c) => c.id)).toEqual([connection.id]);
    expect(asCollector.map((c) => c.id)).toEqual([connection.id]);
  });
});
