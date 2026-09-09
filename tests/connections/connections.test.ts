import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  ConnectionError,
  RESERVATION_TTL_MS,
  cancelConnection,
  expressInterest,
  getConnectionDetail,
  listCollectorConnections,
  listListingInterests,
  listMessages,
  listSellerConnections,
  postMessage,
  revealContact,
  selectBuyer,
  withdrawInterest,
} from "@/lib/connections/connections";
import { db } from "@/lib/db";
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

  it("rejects an interest while the listing has an active reservation", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const alice = await makeUser("+14155550200", ["COLLECTOR"]);
    const bob = await makeUser("+14155550300", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(alice, listing.id);
    await selectBuyer(seller, listing.id, alice);

    await expect(expressInterest(bob, listing.id)).rejects.toThrow(
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
  it("creates a RESERVED connection with an expiry ~ RESERVATION_TTL_MS from now", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);

    const before = Date.now();
    const connection = await selectBuyer(seller, listing.id, collector);
    const after = Date.now();

    expect(connection.status).toBe("RESERVED");
    expect(connection.listingId).toBe(listing.id);
    expect(connection.collectorId).toBe(collector);
    expect(connection.sellerId).toBe(seller);
    const expiresMs = connection.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + RESERVATION_TTL_MS);
    expect(expiresMs).toBeLessThanOrEqual(after + RESERVATION_TTL_MS + 50);
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

  it("rejects selecting a collector who never expressed interest", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);

    await expect(
      selectBuyer(seller, listing.id, collector),
    ).rejects.toThrow(ConnectionError);
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

describe("reservation expiry", () => {
  it("transitions a stale RESERVED to EXPIRED on the next read", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const connection = await selectBuyer(seller, listing.id, collector);

    // Fast-forward: push the row's expiresAt into the past.
    await db.connection.update({
      where: { id: connection.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const asSeller = await listSellerConnections(seller);
    expect(asSeller[0].status).toBe("EXPIRED");
  });

  it("frees the listing so a new buyer can be selected after expiry", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const alice = await makeUser("+14155550200", ["COLLECTOR"]);
    const bob = await makeUser("+14155550300", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(alice, listing.id);
    await expressInterest(bob, listing.id);

    const first = await selectBuyer(seller, listing.id, alice);
    await db.connection.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const second = await selectBuyer(seller, listing.id, bob);
    expect(second.status).toBe("RESERVED");
    expect(second.collectorId).toBe(bob);
  });
});

describe("cancelConnection", () => {
  it("either party can cancel a reservation", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const c1 = await selectBuyer(seller, listing.id, collector);

    const cancelled = await cancelConnection(collector, c1.id);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("frees the listing so the seller can select someone else", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const alice = await makeUser("+14155550200", ["COLLECTOR"]);
    const bob = await makeUser("+14155550300", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(alice, listing.id);
    await expressInterest(bob, listing.id);

    const first = await selectBuyer(seller, listing.id, alice);
    await cancelConnection(seller, first.id);

    const second = await selectBuyer(seller, listing.id, bob);
    expect(second.collectorId).toBe(bob);
  });

  it("refuses cancellation from a stranger", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const outsider = await makeUser("+14155550300", ["HOUSEHOLD"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const c = await selectBuyer(seller, listing.id, collector);

    await expect(cancelConnection(outsider, c.id)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("refuses to cancel a non-RESERVED connection", async () => {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const c = await selectBuyer(seller, listing.id, collector);
    await cancelConnection(seller, c.id);

    await expect(cancelConnection(seller, c.id)).rejects.toThrow(
      ConnectionError,
    );
  });
});

describe("chat", () => {
  async function makeReserved() {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const connection = await selectBuyer(seller, listing.id, collector);
    return { seller, collector, connection };
  }

  it("either party can post a message and both can read the thread", async () => {
    const { seller, collector, connection } = await makeReserved();

    await postMessage(seller, connection.id, "Hi, when can you come by?");
    await new Promise((r) => setTimeout(r, 5));
    await postMessage(collector, connection.id, "Tomorrow at 10 works.");

    const asSeller = await listMessages(seller, connection.id);
    const asCollector = await listMessages(collector, connection.id);
    expect(asSeller.map((m) => m.body)).toEqual([
      "Hi, when can you come by?",
      "Tomorrow at 10 works.",
    ]);
    expect(asCollector.map((m) => m.body)).toEqual(asSeller.map((m) => m.body));
  });

  it("rejects an outsider", async () => {
    const { connection } = await makeReserved();
    const outsider = await makeUser("+14155550999", ["HOUSEHOLD"]);
    await expect(postMessage(outsider, connection.id, "hello")).rejects.toThrow(
      ConnectionError,
    );
    await expect(listMessages(outsider, connection.id)).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects an empty message", async () => {
    const { seller, connection } = await makeReserved();
    await expect(postMessage(seller, connection.id, "   ")).rejects.toThrow(
      ConnectionError,
    );
  });

  it("rejects posting on a cancelled connection", async () => {
    const { seller, collector, connection } = await makeReserved();
    await cancelConnection(seller, connection.id);
    await expect(
      postMessage(collector, connection.id, "still there?"),
    ).rejects.toThrow(ConnectionError);
  });
});

describe("mutual contact reveal", () => {
  async function makeReserved() {
    const seller = await makeUser("+14155550100", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155550200", ["COLLECTOR"]);
    const listing = await seedListing(seller);
    await expressInterest(collector, listing.id);
    const connection = await selectBuyer(seller, listing.id, collector);
    return { seller, collector, listing, connection };
  }

  it("masks phones and hides pickup until both parties reveal", async () => {
    const { seller, connection } = await makeReserved();

    const detail = await getConnectionDetail(seller, connection.id);
    expect(detail.contactRevealed).toBe(false);
    expect(detail.pickup).toBeNull();
    expect(detail.sellerPhone).not.toBe("+14155550100");
    expect(detail.collectorPhone).not.toBe("+14155550200");
  });

  it("reveals contact + pickup once both parties reveal", async () => {
    const { seller, collector, listing, connection } = await makeReserved();

    await revealContact(seller, connection.id);
    let detail = await getConnectionDetail(collector, connection.id);
    expect(detail.contactRevealed).toBe(false);
    expect(detail.youRevealed).toBe(false);
    expect(detail.counterpartyRevealed).toBe(true);

    await revealContact(collector, connection.id);
    detail = await getConnectionDetail(collector, connection.id);
    expect(detail.contactRevealed).toBe(true);
    expect(detail.sellerPhone).toBe("+14155550100");
    expect(detail.collectorPhone).toBe("+14155550200");
    expect(detail.pickup).toEqual({
      latitude: listing.latitude,
      longitude: listing.longitude,
    });
  });

  it("refuses reveal from a stranger and after cancellation", async () => {
    const { seller, connection } = await makeReserved();
    const outsider = await makeUser("+14155550999", ["HOUSEHOLD"]);
    await expect(revealContact(outsider, connection.id)).rejects.toThrow(
      ConnectionError,
    );

    await cancelConnection(seller, connection.id);
    await expect(revealContact(seller, connection.id)).rejects.toThrow(
      ConnectionError,
    );
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
