import { beforeEach, describe, expect, it } from "vitest";
import { recordEvent } from "@/lib/analytics/events";
import {
  getKpiChannelBreakdown,
  getKpiSummary,
  getMonetisationKpis,
  getRepeatUsage,
  getSupplyDemandDensity,
} from "@/lib/analytics/kpis";
import { getOrCreateUserByPhone } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function seed(events: Parameters<typeof recordEvent>[0][]) {
  for (const e of events) await recordEvent(e);
}

describe("getKpiSummary", () => {
  it("counts every event bucket and returns null rates when there are no outcomes", async () => {
    await seed([
      { type: "USER_REGISTERED" },
      { type: "USER_REGISTERED" },
      { type: "LISTING_CREATED", channel: "HOUSEHOLD" },
      { type: "LISTING_VIEWED", channel: "HOUSEHOLD" },
      { type: "LISTING_VIEWED", channel: "HOUSEHOLD" },
      { type: "INTEREST_EXPRESSED", channel: "HOUSEHOLD" },
      { type: "CONNECTION_RESERVED", channel: "HOUSEHOLD" },
    ]);
    const s = await getKpiSummary();
    expect(s.totalRegistrations).toBe(2);
    expect(s.totalListings).toBe(1);
    expect(s.totalListingViews).toBe(2);
    expect(s.totalInterests).toBe(1);
    expect(s.totalReservations).toBe(1);
    expect(s.totalCompletions).toBe(0);
    expect(s.totalFailures).toBe(0);
    expect(s.completionRate).toBeNull();
    expect(s.pickupFailureRate).toBeNull();
    expect(s.noShowRate).toBeNull();
    expect(s.medianResponseSeconds).toBeNull();
    expect(s.repeatCompleters).toBe(0);
  });

  it("aggregates outcome rates across household and bulk channels", async () => {
    await seed([
      // Two household completions and one household failure with a no-show reason.
      {
        type: "CONNECTION_COMPLETED",
        channel: "HOUSEHOLD",
        actorId: "u1",
        metadata: { responseSeconds: 120 },
      },
      {
        type: "CONNECTION_COMPLETED",
        channel: "HOUSEHOLD",
        actorId: "u2",
        metadata: { responseSeconds: 300 },
      },
      {
        type: "CONNECTION_FAILED",
        channel: "HOUSEHOLD",
        actorId: "u3",
        metadata: { responseSeconds: 240, failureReason: "no-show" },
      },
      // One bulk completion.
      {
        type: "BULK_RESPONSE_COMPLETED",
        channel: "BULK",
        actorId: "u4",
        metadata: { responseSeconds: 600 },
      },
      // One bulk failure without a no-show reason.
      {
        type: "BULK_RESPONSE_FAILED",
        channel: "BULK",
        actorId: "u5",
        metadata: { responseSeconds: 180, failureReason: "wrong grade" },
      },
    ]);

    const s = await getKpiSummary();
    expect(s.totalCompletions).toBe(3);
    expect(s.totalFailures).toBe(2);
    expect(s.completionRate).toBeCloseTo(3 / 5, 5);
    expect(s.pickupFailureRate).toBeCloseTo(2 / 5, 5);
    expect(s.noShowRate).toBeCloseTo(1 / 5, 5);
    // Median of [120, 180, 240, 300, 600] = 240
    expect(s.medianResponseSeconds).toBe(240);
  });

  it("counts distinct users with 2+ completions as repeatCompleters", async () => {
    await seed([
      { type: "CONNECTION_COMPLETED", actorId: "u1" },
      { type: "CONNECTION_COMPLETED", actorId: "u1" },
      { type: "CONNECTION_COMPLETED", actorId: "u2" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "u1" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "u3" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "u3" },
    ]);
    // u1: 3, u3: 2 → 2 repeat completers; u2: 1 → not repeat.
    const s = await getKpiSummary();
    expect(s.repeatCompleters).toBe(2);
  });

  it("pulls complaintsCount from the Report table", async () => {
    const { user: reporter } = await getOrCreateUserByPhone("+14155570000");
    await db.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: "some-user",
        reason: "harassment",
      },
    });
    const s = await getKpiSummary();
    expect(s.complaintsCount).toBe(1);
  });

  it("respects the since/until window", async () => {
    const past = new Date("2020-01-01T00:00:00Z");
    await recordEvent({ type: "LISTING_CREATED", createdAt: past });
    await recordEvent({ type: "LISTING_CREATED" });

    const recent = await getKpiSummary({
      since: new Date(Date.now() - 60_000),
    });
    expect(recent.totalListings).toBe(1);
  });
});

describe("getKpiChannelBreakdown", () => {
  it("splits listings / interests / reservations / completions by channel", async () => {
    await seed([
      { type: "LISTING_CREATED", channel: "HOUSEHOLD" },
      { type: "LISTING_CREATED", channel: "HOUSEHOLD" },
      { type: "INTEREST_EXPRESSED", channel: "HOUSEHOLD" },
      { type: "INTEREST_EXPRESSED", channel: "ROUTE" },
      { type: "CONNECTION_RESERVED", channel: "HOUSEHOLD" },
      { type: "CONNECTION_COMPLETED", channel: "HOUSEHOLD" },
      { type: "BULK_REQUIREMENT_CREATED", channel: "BULK" },
      { type: "BULK_RESPONSE_SELECTED", channel: "BULK" },
      { type: "BULK_RESPONSE_COMPLETED", channel: "BULK" },
      { type: "BULK_RESPONSE_FAILED", channel: "BULK" },
    ]);
    const rows = await getKpiChannelBreakdown();
    const household = rows.find((r) => r.channel === "HOUSEHOLD")!;
    const route = rows.find((r) => r.channel === "ROUTE")!;
    const bulk = rows.find((r) => r.channel === "BULK")!;
    expect(household.listings).toBe(2);
    expect(household.interests).toBe(1);
    expect(household.reservations).toBe(1);
    expect(household.completions).toBe(1);
    expect(household.completionRate).toBe(1);
    expect(route.interests).toBe(1);
    expect(route.listings).toBe(0);
    expect(bulk.reservations).toBe(1);
    expect(bulk.completions).toBe(1);
    expect(bulk.failures).toBe(1);
    expect(bulk.completionRate).toBeCloseTo(0.5, 5);
  });
});

describe("getSupplyDemandDensity", () => {
  it("groups supply (listings) and demand (interests + bulk reqs) by locality, material and role", async () => {
    await seed([
      {
        type: "LISTING_CREATED",
        locality: "Koramangala",
        material: "PLASTIC",
        actorRole: "HOUSEHOLD",
      },
      {
        type: "LISTING_CREATED",
        locality: "Koramangala",
        material: "PLASTIC",
        actorRole: "HOUSEHOLD",
      },
      {
        type: "LISTING_CREATED",
        locality: "Indiranagar",
        material: "METAL",
        actorRole: "BUSINESS",
      },
      {
        type: "INTEREST_EXPRESSED",
        locality: "Koramangala",
        material: "PLASTIC",
        actorRole: "COLLECTOR",
      },
      {
        type: "BULK_REQUIREMENT_CREATED",
        locality: "Bengaluru",
        material: "METAL",
        actorRole: "DEALER",
      },
    ]);
    const density = await getSupplyDemandDensity();

    const koramangala = density.byLocality.find((r) => r.key === "Koramangala");
    expect(koramangala?.supply).toBe(2);
    expect(koramangala?.demand).toBe(1);

    const bengaluru = density.byLocality.find((r) => r.key === "Bengaluru");
    expect(bengaluru?.supply).toBe(0);
    expect(bengaluru?.demand).toBe(1);

    const plastic = density.byMaterial.find((r) => r.key === "PLASTIC");
    expect(plastic?.supply).toBe(2);
    expect(plastic?.demand).toBe(1);

    const collector = density.byRole.find((r) => r.key === "COLLECTOR");
    expect(collector?.supply).toBe(0);
    expect(collector?.demand).toBe(1);
  });
});

describe("getMonetisationKpis", () => {
  it("counts active promotions/subscriptions/placements and sums declared revenue", async () => {
    const { user: pro } = await getOrCreateUserByPhone("+911111111111");
    const { user: viewer } = await getOrCreateUserByPhone("+912222222222");

    async function makeListing(title: string) {
      return db.listing.create({
        data: {
          sellerId: pro.id,
          sellerType: "BUSINESS",
          materialCategory: "PLASTIC",
          title,
          photos: "[]",
          quantityMin: 1,
          quantityMax: 2,
          quantityUnit: "KG",
          locality: "Somewhere",
          latitude: 0,
          longitude: 0,
          availability: "WEEKENDS",
        },
      });
    }
    const l1 = await makeListing("l1");
    const l2 = await makeListing("l2");
    const l3 = await makeListing("l3");

    // Two active promotions (one expired), one active subscription, one paused
    // ad placement (should not count as active).
    await db.promotion.createMany({
      data: [
        {
          listingId: l1.id,
          promoterId: pro.id,
          tier: "STANDARD",
          status: "ACTIVE",
          priceCents: 100,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 60_000),
        },
        {
          listingId: l2.id,
          promoterId: pro.id,
          tier: "PREMIUM",
          status: "ACTIVE",
          priceCents: 200,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 60_000),
        },
        {
          listingId: l3.id,
          promoterId: pro.id,
          tier: "STANDARD",
          status: "EXPIRED",
          priceCents: 100,
          startsAt: new Date(Date.now() - 3600_000),
          endsAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    await db.premiumSubscription.create({
      data: {
        subscriberId: pro.id,
        plan: "BUSINESS",
        status: "ACTIVE",
        priceCents: 999,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60_000),
      },
    });
    await db.adPlacement.createMany({
      data: [
        {
          surface: "DISCOVERY",
          headline: "Active",
          body: "b",
          linkUrl: "https://x",
        },
        {
          surface: "DISCOVERY",
          headline: "Paused",
          body: "b",
          linkUrl: "https://x",
          status: "PAUSED",
        },
      ],
    });

    await seed([
      {
        type: "PROMOTION_PURCHASED",
        actorId: pro.id,
        metadata: { priceCents: 100 },
      },
      {
        type: "PROMOTION_PURCHASED",
        actorId: pro.id,
        metadata: { priceCents: 200 },
      },
      { type: "PROMOTION_CANCELLED", actorId: pro.id },
      { type: "PROMOTION_EXPIRED", actorId: pro.id },
      {
        type: "SUBSCRIPTION_STARTED",
        actorId: pro.id,
        metadata: { priceCents: 999 },
      },
      { type: "AD_PLACEMENT_IMPRESSION", actorId: viewer.id },
      { type: "AD_PLACEMENT_IMPRESSION", actorId: viewer.id },
      { type: "AD_PLACEMENT_CLICK", actorId: viewer.id },
    ]);

    const k = await getMonetisationKpis();
    expect(k.activePromotions).toBe(2);
    expect(k.totalPromotionsPurchased).toBe(2);
    expect(k.totalPromotionsCancelled).toBe(1);
    expect(k.totalPromotionsExpired).toBe(1);
    expect(k.activeSubscriptions).toBe(1);
    expect(k.totalSubscriptionsStarted).toBe(1);
    expect(k.activeAdPlacements).toBe(1);
    expect(k.adImpressions).toBe(2);
    expect(k.adClicks).toBe(1);
    expect(k.adClickThroughRate).toBeCloseTo(0.5);
    expect(k.promotionRevenueCentsDeclared).toBe(300);
    expect(k.subscriptionRevenueCentsDeclared).toBe(999);
  });
});

describe("getRepeatUsage", () => {
  it("splits repeat vs one-time completers by role", async () => {
    await seed([
      { type: "CONNECTION_COMPLETED", actorId: "h1", actorRole: "HOUSEHOLD" },
      { type: "CONNECTION_COMPLETED", actorId: "h1", actorRole: "HOUSEHOLD" },
      { type: "CONNECTION_COMPLETED", actorId: "h2", actorRole: "HOUSEHOLD" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "d1", actorRole: "DEALER" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "d1", actorRole: "DEALER" },
      { type: "BULK_RESPONSE_COMPLETED", actorId: "d2", actorRole: "DEALER" },
    ]);
    const rows = await getRepeatUsage();
    const household = rows.find((r) => r.role === "HOUSEHOLD");
    const dealer = rows.find((r) => r.role === "DEALER");
    expect(household?.repeatCount).toBe(1);
    expect(household?.onceCount).toBe(1);
    expect(household?.distinctCompleters).toBe(2);
    expect(dealer?.repeatCount).toBe(1);
    expect(dealer?.onceCount).toBe(1);
  });
});
