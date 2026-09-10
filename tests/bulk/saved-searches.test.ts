import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser } from "@/lib/blocks/blocks";
import {
  createSavedSearch,
  deleteSavedSearch,
  fanOutSavedSearchesForNewListing,
  listSavedSearchAlertsForBuyer,
  listSavedSearchesForBuyer,
  markSavedSearchAlertSeen,
  SavedSearchError,
  updateSavedSearch,
} from "@/lib/bulk/saved-searches";
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
    material: string;
    quantityMax: number;
    quantityUnit: string;
    locality: string;
    status: string;
  }> = {},
) {
  return db.listing.create({
    data: {
      sellerId,
      sellerType: "HOUSEHOLD",
      materialCategory: overrides.material ?? "PLASTIC",
      title: "Some listing",
      photos: JSON.stringify(["https://example.com/x.jpg"]),
      quantityMin: 1,
      quantityMax: overrides.quantityMax ?? 5,
      quantityUnit: overrides.quantityUnit ?? "KG",
      locality: overrides.locality ?? "Bengaluru South",
      latitude: 12.9,
      longitude: 77.6,
      availability: "ANYTIME",
      status: overrides.status ?? "ACTIVE",
    },
  });
}

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "PET bottles in Bengaluru",
    material: "PLASTIC",
    supplyMinQuantity: 2,
    supplyMinQuantityUnit: "KG",
    region: "Bengaluru",
    alertsEnabled: true,
    ...overrides,
  };
}

describe("createSavedSearch", () => {
  it("creates a search for a DEALER", async () => {
    const buyer = await makeUser("+14155555000", ["DEALER"]);
    const s = await createSavedSearch(buyer, validInput());
    expect(s.buyerId).toBe(buyer);
    expect(s.name).toBe("PET bottles in Bengaluru");
    expect(s.material).toBe("PLASTIC");
    expect(s.supplyMinQuantity).toBe(2);
    expect(s.region).toBe("Bengaluru");
    expect(s.alertsEnabled).toBe(true);
  });

  it("refuses when caller has no bulk-buyer role", async () => {
    const household = await makeUser("+14155555001", ["HOUSEHOLD"]);
    await expect(
      createSavedSearch(household, validInput()),
    ).rejects.toMatchObject({ code: "not_a_bulk_buyer" } as SavedSearchError);
  });

  it("accepts a search with no filters (matches every listing)", async () => {
    const buyer = await makeUser("+14155555002", ["DEALER"]);
    const s = await createSavedSearch(buyer, {
      name: "All new supply",
    });
    expect(s.material).toBeNull();
    expect(s.supplyMinQuantity).toBeNull();
    expect(s.region).toBeNull();
  });

  it("rejects a search whose min quantity is set without a unit", async () => {
    const buyer = await makeUser("+14155555003", ["DEALER"]);
    await expect(
      createSavedSearch(buyer, {
        name: "Broken",
        supplyMinQuantity: 5,
      }),
    ).rejects.toThrow();
  });
});

describe("updateSavedSearch", () => {
  it("updates the caller's search", async () => {
    const buyer = await makeUser("+14155555100", ["DEALER"]);
    const s = await createSavedSearch(buyer, validInput());
    const out = await updateSavedSearch(buyer, s.id, {
      name: "Renamed",
      alertsEnabled: false,
    });
    expect(out.name).toBe("Renamed");
    expect(out.alertsEnabled).toBe(false);
  });

  it("refuses on someone else's search", async () => {
    const a = await makeUser("+14155555110", ["DEALER"]);
    const b = await makeUser("+14155555111", ["DEALER"]);
    const s = await createSavedSearch(a, validInput());
    await expect(
      updateSavedSearch(b, s.id, { name: "no" }),
    ).rejects.toMatchObject({ code: "forbidden" } as SavedSearchError);
  });
});

describe("deleteSavedSearch", () => {
  it("removes the caller's search", async () => {
    const buyer = await makeUser("+14155555200", ["DEALER"]);
    const s = await createSavedSearch(buyer, validInput());
    await deleteSavedSearch(buyer, s.id);
    expect(await listSavedSearchesForBuyer(buyer)).toEqual([]);
  });

  it("refuses on someone else's search", async () => {
    const a = await makeUser("+14155555210", ["DEALER"]);
    const b = await makeUser("+14155555211", ["DEALER"]);
    const s = await createSavedSearch(a, validInput());
    await expect(deleteSavedSearch(b, s.id)).rejects.toMatchObject({
      code: "forbidden",
    } as SavedSearchError);
  });
});

describe("fanOutSavedSearchesForNewListing", () => {
  it("inserts an alert for every matching saved search", async () => {
    const buyerA = await makeUser("+14155555300", ["DEALER"]);
    const buyerB = await makeUser("+14155555301", ["RECYCLER"]);
    const seller = await makeUser("+14155555302", ["HOUSEHOLD"]);
    await createSavedSearch(buyerA, validInput());
    await createSavedSearch(buyerB, validInput());
    const listing = await makeListing(seller);

    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(2);
    const alertsA = await listSavedSearchAlertsForBuyer(buyerA);
    const alertsB = await listSavedSearchAlertsForBuyer(buyerB);
    expect(alertsA).toHaveLength(1);
    expect(alertsB).toHaveLength(1);
  });

  it("skips saved searches whose material doesn't match", async () => {
    const buyer = await makeUser("+14155555310", ["DEALER"]);
    const seller = await makeUser("+14155555311", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput({ material: "PAPER" }));
    const listing = await makeListing(seller, { material: "PLASTIC" });

    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips saved searches whose minQty is above the listing's max, or in another unit", async () => {
    const buyer = await makeUser("+14155555320", ["DEALER"]);
    const seller = await makeUser("+14155555321", ["HOUSEHOLD"]);
    await createSavedSearch(
      buyer,
      validInput({ supplyMinQuantity: 100, supplyMinQuantityUnit: "KG" }),
    );
    await createSavedSearch(
      buyer,
      validInput({
        name: "Wrong unit",
        supplyMinQuantity: 2,
        supplyMinQuantityUnit: "PIECES",
      }),
    );
    const listing = await makeListing(seller, {
      quantityMax: 5,
      quantityUnit: "KG",
    });

    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips saved searches whose region substring doesn't match the listing's locality", async () => {
    const buyer = await makeUser("+14155555330", ["DEALER"]);
    const seller = await makeUser("+14155555331", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput({ region: "Delhi" }));
    const listing = await makeListing(seller, { locality: "Bengaluru South" });

    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips saved searches whose owner opted out (alertsEnabled=false)", async () => {
    const buyer = await makeUser("+14155555340", ["DEALER"]);
    const seller = await makeUser("+14155555341", ["HOUSEHOLD"]);
    const s = await createSavedSearch(buyer, validInput());
    await updateSavedSearch(buyer, s.id, { alertsEnabled: false });
    const listing = await makeListing(seller);
    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips a buyer's own listing", async () => {
    const buyer = await makeUser("+14155555350", ["DEALER"]);
    await createSavedSearch(buyer, validInput());
    // The buyer's own listing is not fanned to themself.
    const ownListing = await makeListing(buyer);
    const written = await fanOutSavedSearchesForNewListing(ownListing.id);
    expect(written).toBe(0);
  });

  it("skips listings from either side of a block", async () => {
    const buyer = await makeUser("+14155555355", ["DEALER"]);
    const seller = await makeUser("+14155555356", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    await blockUser(buyer, seller);
    const listing = await makeListing(seller);
    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips listings when the buyer has been blocked by the seller", async () => {
    const buyer = await makeUser("+14155555357", ["DEALER"]);
    const seller = await makeUser("+14155555358", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    await blockUser(seller, buyer);
    const listing = await makeListing(seller);
    const written = await fanOutSavedSearchesForNewListing(listing.id);
    expect(written).toBe(0);
  });

  it("skips PAUSED and CLOSED listings", async () => {
    const buyer = await makeUser("+14155555360", ["DEALER"]);
    const seller = await makeUser("+14155555361", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    const paused = await makeListing(seller, { status: "PAUSED" });
    const written = await fanOutSavedSearchesForNewListing(paused.id);
    expect(written).toBe(0);
  });

  it("is idempotent — a repeat call for the same listing writes 0 new rows", async () => {
    const buyer = await makeUser("+14155555370", ["DEALER"]);
    const seller = await makeUser("+14155555371", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    const listing = await makeListing(seller);
    const first = await fanOutSavedSearchesForNewListing(listing.id);
    expect(first).toBe(1);
    const second = await fanOutSavedSearchesForNewListing(listing.id);
    expect(second).toBe(0);
  });
});

describe("listSavedSearchAlertsForBuyer + markSavedSearchAlertSeen", () => {
  it("returns unseen first, most recent within the group", async () => {
    const buyer = await makeUser("+14155555400", ["DEALER"]);
    const seller = await makeUser("+14155555401", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    const l1 = await makeListing(seller);
    await fanOutSavedSearchesForNewListing(l1.id);
    await new Promise((r) => setTimeout(r, 5));
    const l2 = await makeListing(seller);
    await fanOutSavedSearchesForNewListing(l2.id);
    // Mark the older alert (l1) as seen — the newer unseen row (l2) then
    // bubbles up first because unseen sorts before seen.
    const alerts = await listSavedSearchAlertsForBuyer(buyer);
    const olderAlert = alerts.find((a) => a.listing.id === l1.id)!;
    await markSavedSearchAlertSeen(buyer, olderAlert.id);

    const rows = await listSavedSearchAlertsForBuyer(buyer);
    expect(rows.map((r) => r.listing.id)).toEqual([l2.id, l1.id]);
    // The unseen row comes first regardless of createdAt when the other is seen.
    expect(rows[0].seenAt).toBeNull();
    expect(rows[1].seenAt).not.toBeNull();
  });

  it("refuses to mark someone else's alert", async () => {
    const buyer = await makeUser("+14155555410", ["DEALER"]);
    const stranger = await makeUser("+14155555411", ["DEALER"]);
    const seller = await makeUser("+14155555412", ["HOUSEHOLD"]);
    await createSavedSearch(buyer, validInput());
    const listing = await makeListing(seller);
    await fanOutSavedSearchesForNewListing(listing.id);
    const [alert] = await listSavedSearchAlertsForBuyer(buyer);
    await expect(
      markSavedSearchAlertSeen(stranger, alert.id),
    ).rejects.toMatchObject({ code: "forbidden" } as SavedSearchError);
  });
});
