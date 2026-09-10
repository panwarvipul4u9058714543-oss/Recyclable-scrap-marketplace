import { beforeEach, describe, expect, it } from "vitest";
import { countEvents, listEvents } from "@/lib/analytics/events";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { createBulkRequirement } from "@/lib/bulk/requirements";
import {
  markBulkCompleted,
  markBulkFailed,
  respondToBulkRequirement,
  revealBulkContact,
  selectBulkResponse,
  cancelBulkResponse,
} from "@/lib/bulk/responses";
import {
  cancelConnection,
  expressInterest,
  markCompleted,
  markFailed,
  revealContact,
  selectBuyer,
} from "@/lib/connections/connections";
import { db } from "@/lib/db";
import { discoverNearby } from "@/lib/discovery/discovery";
import { createListing } from "@/lib/listings/listings";
import { fanOutForNewListing } from "@/lib/routes/notifications";
import { startRoute } from "@/lib/routes/routes";
import type { Role } from "@/lib/roles";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: Role[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

const listingBase = {
  sellerType: "HOUSEHOLD" as const,
  materialCategory: "PLASTIC" as const,
  title: "Clean PET",
  photos: ["https://example.com/1.jpg"],
  quantityMin: 5,
  quantityMax: 10,
  quantityUnit: "KG" as const,
  locality: "Koramangala",
  latitude: 12.9352,
  longitude: 77.6245,
  availability: "WEEKENDS" as const,
};

describe("user registration recording", () => {
  it("records USER_REGISTERED once when a new account is created", async () => {
    await getOrCreateUserByPhone("+14155559100");
    expect(await countEvents({ type: "USER_REGISTERED" })).toBe(1);

    // Second lookup for the same phone is not a registration — no new row.
    await getOrCreateUserByPhone("+14155559100");
    expect(await countEvents({ type: "USER_REGISTERED" })).toBe(1);
  });
});

describe("listing lifecycle wiring", () => {
  it("createListing emits LISTING_CREATED tagged HOUSEHOLD with material + locality", async () => {
    const seller = await makeUser("+14155559200", ["HOUSEHOLD"]);
    const listing = await createListing(seller, listingBase);

    const events = await listEvents({ type: "LISTING_CREATED" });
    expect(events).toHaveLength(1);
    expect(events[0].actorId).toBe(seller);
    expect(events[0].channel).toBe("HOUSEHOLD");
    expect(events[0].subjectType).toBe("LISTING");
    expect(events[0].subjectId).toBe(listing.id);
    expect(events[0].material).toBe("PLASTIC");
    expect(events[0].locality).toBe("Koramangala");
  });

  it("discoverNearby records one LISTING_VIEWED per returned listing", async () => {
    const seller = await makeUser("+14155559300", ["HOUSEHOLD"]);
    const viewer = await makeUser("+14155559301", ["COLLECTOR"]);
    await createListing(seller, listingBase);
    await createListing(seller, { ...listingBase, title: "More PET" });

    // Ignore LISTING_CREATED noise from setup.
    const beforeViews = await countEvents({ type: "LISTING_VIEWED" });
    await discoverNearby(viewer, {
      near: { latitude: 12.94, longitude: 77.62 },
    });
    const afterViews = await countEvents({ type: "LISTING_VIEWED" });
    expect(afterViews - beforeViews).toBe(2);
  });
});

describe("connection lifecycle wiring", () => {
  it("expressInterest emits INTEREST_EXPRESSED tagged HOUSEHOLD (once, idempotent)", async () => {
    const seller = await makeUser("+14155559400", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155559401", ["COLLECTOR"]);
    const listing = await createListing(seller, listingBase);

    await expressInterest(collector, listing.id);
    await expressInterest(collector, listing.id);

    const events = await listEvents({ type: "INTEREST_EXPRESSED" });
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe("HOUSEHOLD");
    expect(events[0].actorId).toBe(collector);
    expect(events[0].material).toBe("PLASTIC");
  });

  it("expressInterest tags the channel as ROUTE when the collector has a route-match notification for that listing", async () => {
    const seller = await makeUser("+14155559500", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155559501", ["COLLECTOR"]);
    // Route that trivially matches — origin and destination near the listing so
    // the detour is well within the cap.
    await startRoute(collector, {
      originLatitude: 12.9352,
      originLongitude: 77.6245,
      destLatitude: 12.94,
      destLongitude: 77.62,
      departAt: new Date(Date.now() + 3600_000).toISOString(),
      arriveByAt: new Date(Date.now() + 7200_000).toISOString(),
      acceptedMaterials: [],
      maxDetourKm: 25,
    });
    const listing = await createListing(seller, listingBase);
    // createListing already fans out notifications; force a re-run to be sure.
    await fanOutForNewListing(listing.id);

    await expressInterest(collector, listing.id);

    const events = await listEvents({ type: "INTEREST_EXPRESSED" });
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe("ROUTE");
  });

  it("selectBuyer / cancel / reveal / complete / fail each emit their event", async () => {
    const seller = await makeUser("+14155559600", ["HOUSEHOLD"]);
    const collector = await makeUser("+14155559601", ["COLLECTOR"]);
    const listing = await createListing(seller, listingBase);
    await expressInterest(collector, listing.id);
    const conn = await selectBuyer(seller, listing.id, collector);

    expect(await countEvents({ type: "CONNECTION_RESERVED" })).toBe(1);

    // Reveal both sides — mutual-reveal event fires only on the second.
    await revealContact(seller, conn.id);
    expect(await countEvents({ type: "MUTUAL_REVEAL_COMPLETED" })).toBe(0);
    await revealContact(collector, conn.id);
    expect(await countEvents({ type: "MUTUAL_REVEAL_COMPLETED" })).toBe(1);

    // Complete one → completed event; separate listing for cancel + fail.
    await markCompleted(seller, conn.id, {
      actualQuantity: 7,
      finalPrice: 100,
    });
    expect(await countEvents({ type: "CONNECTION_COMPLETED" })).toBe(1);

    const listing2 = await createListing(seller, {
      ...listingBase,
      title: "Second PET",
    });
    await expressInterest(collector, listing2.id);
    const conn2 = await selectBuyer(seller, listing2.id, collector);
    await cancelConnection(seller, conn2.id);
    expect(await countEvents({ type: "CONNECTION_CANCELLED" })).toBe(1);

    const listing3 = await createListing(seller, {
      ...listingBase,
      title: "Third PET",
    });
    await expressInterest(collector, listing3.id);
    const conn3 = await selectBuyer(seller, listing3.id, collector);
    await markFailed(seller, conn3.id, { failureReason: "no-show" });
    expect(await countEvents({ type: "CONNECTION_FAILED" })).toBe(1);

    // Failed event captures the failure reason in metadata.
    const failedEvents = await listEvents({ type: "CONNECTION_FAILED" });
    expect(failedEvents[0].metadata?.failureReason).toBe("no-show");
  });
});

describe("route wiring", () => {
  it("startRoute emits ROUTE_STARTED tagged ROUTE", async () => {
    const collector = await makeUser("+14155559700", ["COLLECTOR"]);
    const route = await startRoute(collector, {
      originLatitude: 12.9352,
      originLongitude: 77.6245,
      destLatitude: 12.94,
      destLongitude: 77.62,
      departAt: new Date(Date.now() + 3600_000).toISOString(),
      arriveByAt: new Date(Date.now() + 7200_000).toISOString(),
      acceptedMaterials: [],
      maxDetourKm: 10,
    });
    const events = await listEvents({ type: "ROUTE_STARTED" });
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe("ROUTE");
    expect(events[0].actorId).toBe(collector);
    expect(events[0].subjectId).toBe(route.id);
  });

  it("fanOutForNewListing emits ROUTE_MATCH_NOTIFIED per new notification, but not for a repeat fan-out", async () => {
    const collector = await makeUser("+14155559800", ["COLLECTOR"]);
    const seller = await makeUser("+14155559801", ["HOUSEHOLD"]);
    await startRoute(collector, {
      originLatitude: 12.9352,
      originLongitude: 77.6245,
      destLatitude: 12.94,
      destLongitude: 77.62,
      departAt: new Date(Date.now() + 3600_000).toISOString(),
      arriveByAt: new Date(Date.now() + 7200_000).toISOString(),
      acceptedMaterials: [],
      maxDetourKm: 25,
    });
    const listing = await createListing(seller, listingBase);
    // createListing already fanned out; a manual re-run is a no-op.
    const written = await fanOutForNewListing(listing.id);
    expect(written).toBe(0);

    const notifs = await db.routeNotification.findMany({ where: { collectorId: collector } });
    const notifEvents = await countEvents({ type: "ROUTE_MATCH_NOTIFIED" });
    // Exactly one notification, exactly one event.
    expect(notifs).toHaveLength(1);
    expect(notifEvents).toBe(1);
  });
});

describe("bulk wiring", () => {
  it("createBulkRequirement emits BULK_REQUIREMENT_CREATED tagged BULK", async () => {
    const buyer = await makeUser("+14155559900", ["DEALER"]);
    await createBulkRequirement(buyer, {
      material: "METAL",
      minQuantity: 100,
      minQuantityUnit: "KG",
      region: "Bengaluru",
    });
    const events = await listEvents({ type: "BULK_REQUIREMENT_CREATED" });
    expect(events).toHaveLength(1);
    expect(events[0].channel).toBe("BULK");
    expect(events[0].material).toBe("METAL");
    expect(events[0].locality).toBe("Bengaluru");
  });

  it("bulk response lifecycle emits created → selected → mutual-reveal → completed", async () => {
    const buyer = await makeUser("+14155560000", ["DEALER"]);
    const supplier = await makeUser("+14155560001", ["COLLECTOR"]);
    const req = await createBulkRequirement(buyer, {
      material: "METAL",
      minQuantity: 100,
      minQuantityUnit: "KG",
      region: "Bengaluru",
    });
    const resp = await respondToBulkRequirement(supplier, req.id, {
      offeredQuantity: 150,
      offeredQuantityUnit: "KG",
    });
    expect(await countEvents({ type: "BULK_RESPONSE_CREATED" })).toBe(1);
    // Idempotent second call — no duplicate event.
    await respondToBulkRequirement(supplier, req.id, {
      offeredQuantity: 150,
      offeredQuantityUnit: "KG",
    });
    expect(await countEvents({ type: "BULK_RESPONSE_CREATED" })).toBe(1);

    await selectBulkResponse(buyer, resp.id);
    expect(await countEvents({ type: "BULK_RESPONSE_SELECTED" })).toBe(1);

    await revealBulkContact(buyer, resp.id);
    expect(await countEvents({ type: "BULK_MUTUAL_REVEAL_COMPLETED" })).toBe(0);
    await revealBulkContact(supplier, resp.id);
    expect(await countEvents({ type: "BULK_MUTUAL_REVEAL_COMPLETED" })).toBe(1);

    await markBulkCompleted(buyer, resp.id, { actualQuantity: 120 });
    expect(await countEvents({ type: "BULK_RESPONSE_COMPLETED" })).toBe(1);
  });

  it("bulk cancel and fail each emit their event", async () => {
    const buyer = await makeUser("+14155560100", ["DEALER"]);
    const supplier = await makeUser("+14155560101", ["COLLECTOR"]);
    const req = await createBulkRequirement(buyer, {
      material: "METAL",
      minQuantity: 100,
      minQuantityUnit: "KG",
      region: "Bengaluru",
    });
    const resp = await respondToBulkRequirement(supplier, req.id, {
      offeredQuantity: 150,
      offeredQuantityUnit: "KG",
    });
    await selectBulkResponse(buyer, resp.id);
    await cancelBulkResponse(buyer, resp.id);
    expect(await countEvents({ type: "BULK_RESPONSE_CANCELLED" })).toBe(1);

    // Fresh req for the failure branch (a cancelled response is terminal).
    const req2 = await createBulkRequirement(buyer, {
      material: "PAPER",
      minQuantity: 50,
      minQuantityUnit: "KG",
      region: "Bengaluru",
    });
    const resp2 = await respondToBulkRequirement(supplier, req2.id, {
      offeredQuantity: 75,
      offeredQuantityUnit: "KG",
    });
    await selectBulkResponse(buyer, resp2.id);
    await markBulkFailed(buyer, resp2.id, { failureReason: "no-show" });
    expect(await countEvents({ type: "BULK_RESPONSE_FAILED" })).toBe(1);
  });
});

describe("saved-search fan-out wiring", () => {
  it("emits SAVED_SEARCH_ALERT_CREATED per matching search when a new listing is created", async () => {
    const buyer = await makeUser("+14155560200", ["DEALER"]);
    const seller = await makeUser("+14155560201", ["HOUSEHOLD"]);
    await db.savedSearch.create({
      data: {
        buyerId: buyer,
        name: "PET in Bengaluru",
        material: "PLASTIC",
        region: "Koramangala",
      },
    });
    await createListing(seller, listingBase);

    const events = await listEvents({ type: "SAVED_SEARCH_ALERT_CREATED" });
    expect(events).toHaveLength(1);
    expect(events[0].actorId).toBe(buyer);
    expect(events[0].channel).toBe("BULK");
    expect(events[0].material).toBe("PLASTIC");
  });
});
