import { beforeEach, describe, expect, it } from "vitest";
import { countEvents } from "@/lib/analytics/events";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { createListing } from "@/lib/listings/listings";
import {
  cancelPromotion,
  expirePromotions,
  isListingPromoted,
  listActivePromotionsForListingIds,
  purchasePromotion,
} from "@/lib/monetisation/promotions";
import {
  cancelSubscription,
  getActiveSubscription,
  subscribe,
} from "@/lib/monetisation/subscriptions";
import {
  createAdPlacement,
  listActiveAdPlacements,
  recordAdClick,
  recordAdImpression,
  setAdPlacementStatus,
} from "@/lib/monetisation/ads";
import { MonetisationError } from "@/lib/monetisation/errors";
import type { Role } from "@/lib/roles";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  process.env.MONETISATION_ENABLED = "1";
  await resetDb();
});

async function makeUser(phone: string, roles: Role[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

async function makeListing(sellerId: string) {
  return createListing(sellerId, {
    sellerType: "BUSINESS",
    materialCategory: "PLASTIC",
    title: "Clean PET",
    photos: ["https://example.com/1.jpg"],
    quantityMin: 5,
    quantityMax: 10,
    quantityUnit: "KG",
    locality: "Koramangala",
    latitude: 12.9352,
    longitude: 77.6245,
    availability: "WEEKENDS",
  });
}

describe("promotions", () => {
  it("refuses purchases when the monetisation flag is off", async () => {
    process.env.MONETISATION_ENABLED = "0";
    const sellerId = await makeUser("+911111111111", ["BUSINESS"]);
    const listing = await makeListing(sellerId);
    await expect(
      purchasePromotion(sellerId, { listingId: listing.id, tier: "STANDARD" }),
    ).rejects.toBeInstanceOf(MonetisationError);
  });

  it("refuses purchases from non-professional roles", async () => {
    const householderId = await makeUser("+911111111111", ["HOUSEHOLD"]);
    // Household seller creates their own listing then tries to promote it.
    const listing = await createListing(householderId, {
      sellerType: "HOUSEHOLD",
      materialCategory: "PLASTIC",
      title: "PET bottles",
      photos: ["https://example.com/2.jpg"],
      quantityMin: 1,
      quantityMax: 2,
      quantityUnit: "KG",
      locality: "Indiranagar",
      latitude: 12.97,
      longitude: 77.6,
      availability: "WEEKENDS",
    });
    await expect(
      purchasePromotion(householderId, {
        listingId: listing.id,
        tier: "STANDARD",
      }),
    ).rejects.toMatchObject({ code: "not_professional" });
  });

  it("purchases a promotion, activates it, and records analytics events", async () => {
    const sellerId = await makeUser("+911111111111", ["BUSINESS"]);
    const listing = await makeListing(sellerId);
    const promo = await purchasePromotion(sellerId, {
      listingId: listing.id,
      tier: "PREMIUM",
    });
    expect(promo.status).toBe("ACTIVE");
    expect(promo.tier).toBe("PREMIUM");
    expect(promo.priceCents).toBeGreaterThan(0);
    expect(promo.endsAt.getTime()).toBeGreaterThan(Date.now());

    expect(await isListingPromoted(listing.id)).toBe(true);
    const map = await listActivePromotionsForListingIds([listing.id]);
    expect(map.get(listing.id)?.tier).toBe("PREMIUM");

    expect(
      await countEvents({ type: "PROMOTION_PURCHASED" }),
    ).toBe(1);
    expect(
      await countEvents({ type: "PROMOTION_ACTIVATED" }),
    ).toBe(1);
  });

  it("refuses to promote a listing the caller does not own", async () => {
    const owner = await makeUser("+911111111111", ["BUSINESS"]);
    const stranger = await makeUser("+912222222222", ["BUSINESS"]);
    const listing = await makeListing(owner);
    await expect(
      purchasePromotion(stranger, {
        listingId: listing.id,
        tier: "STANDARD",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("cancels an active promotion and stops boosting the listing", async () => {
    const sellerId = await makeUser("+911111111111", ["BUSINESS"]);
    const listing = await makeListing(sellerId);
    const promo = await purchasePromotion(sellerId, {
      listingId: listing.id,
      tier: "STANDARD",
    });
    await cancelPromotion(sellerId, promo.id);
    expect(await isListingPromoted(listing.id)).toBe(false);
    expect(await countEvents({ type: "PROMOTION_CANCELLED" })).toBe(1);
  });

  it("marks expired promotions and records an expiry event", async () => {
    const sellerId = await makeUser("+911111111111", ["BUSINESS"]);
    const listing = await makeListing(sellerId);
    const promo = await purchasePromotion(sellerId, {
      listingId: listing.id,
      tier: "STANDARD",
    });
    // Rewrite endsAt to the past so expirePromotions catches it.
    await db.promotion.update({
      where: { id: promo.id },
      data: { endsAt: new Date(Date.now() - 60_000) },
    });
    const expired = await expirePromotions();
    expect(expired).toBe(1);
    expect(await isListingPromoted(listing.id)).toBe(false);
    expect(await countEvents({ type: "PROMOTION_EXPIRED" })).toBe(1);
  });
});

describe("subscriptions", () => {
  it("refuses subscribing when the monetisation flag is off", async () => {
    process.env.MONETISATION_ENABLED = "0";
    const proId = await makeUser("+911111111111", ["DEALER"]);
    await expect(subscribe(proId, { plan: "BUSINESS" })).rejects.toBeInstanceOf(
      MonetisationError,
    );
  });

  it("refuses non-professional roles", async () => {
    const householderId = await makeUser("+911111111111", ["HOUSEHOLD"]);
    await expect(
      subscribe(householderId, { plan: "BUSINESS" }),
    ).rejects.toMatchObject({ code: "not_professional" });
  });

  it("starts a subscription and records SUBSCRIPTION_STARTED", async () => {
    const proId = await makeUser("+911111111111", ["DEALER"]);
    const sub = await subscribe(proId, { plan: "PRO" });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.plan).toBe("PRO");
    expect(await getActiveSubscription(proId)).not.toBeNull();
    expect(await countEvents({ type: "SUBSCRIPTION_STARTED" })).toBe(1);
  });

  it("refuses a second active subscription for the same user", async () => {
    const proId = await makeUser("+911111111111", ["DEALER"]);
    await subscribe(proId, { plan: "BUSINESS" });
    await expect(subscribe(proId, { plan: "PRO" })).rejects.toMatchObject({
      code: "already_active",
    });
  });

  it("cancels the active subscription and records SUBSCRIPTION_CANCELLED", async () => {
    const proId = await makeUser("+911111111111", ["DEALER"]);
    const sub = await subscribe(proId, { plan: "BUSINESS" });
    await cancelSubscription(proId, sub.id);
    expect(await getActiveSubscription(proId)).toBeNull();
    expect(await countEvents({ type: "SUBSCRIPTION_CANCELLED" })).toBe(1);
  });
});

describe("ad placements", () => {
  it("refuses creating a placement when the monetisation flag is off", async () => {
    process.env.MONETISATION_ENABLED = "0";
    const adminId = await makeUser("+911111111111", ["BUSINESS"]);
    await db.user.update({
      where: { id: adminId },
      data: { isAdmin: true },
    });
    await expect(
      createAdPlacement(adminId, {
        surface: "DISCOVERY",
        headline: "Try premium",
        body: "Higher visibility",
        linkUrl: "https://example.com",
      }),
    ).rejects.toBeInstanceOf(MonetisationError);
  });

  it("refuses non-admin creators", async () => {
    const uid = await makeUser("+911111111111", ["BUSINESS"]);
    await expect(
      createAdPlacement(uid, {
        surface: "DISCOVERY",
        headline: "Try premium",
        body: "Higher visibility",
        linkUrl: "https://example.com",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("creates a placement, lists it, and records impression/click events", async () => {
    const adminId = await makeUser("+911111111111", ["BUSINESS"]);
    await db.user.update({
      where: { id: adminId },
      data: { isAdmin: true },
    });
    const viewerId = await makeUser("+912222222222", ["HOUSEHOLD"]);

    const placement = await createAdPlacement(adminId, {
      surface: "DISCOVERY",
      headline: "Try premium",
      body: "Higher visibility",
      linkUrl: "https://example.com",
      sponsorName: "Acme Recyclers",
    });
    expect(placement.status).toBe("ACTIVE");
    expect(await countEvents({ type: "AD_PLACEMENT_CREATED" })).toBe(1);

    const active = await listActiveAdPlacements("DISCOVERY");
    expect(active.map((p) => p.id)).toContain(placement.id);

    await recordAdImpression(placement.id, viewerId);
    await recordAdClick(placement.id, viewerId);
    expect(await countEvents({ type: "AD_PLACEMENT_IMPRESSION" })).toBe(1);
    expect(await countEvents({ type: "AD_PLACEMENT_CLICK" })).toBe(1);

    // Pausing hides it from the surface list without deleting the row.
    await setAdPlacementStatus(adminId, placement.id, "PAUSED");
    const stillActive = await listActiveAdPlacements("DISCOVERY");
    expect(stillActive.map((p) => p.id)).not.toContain(placement.id);
  });

  it("returns no placements when the monetisation flag is off, without throwing", async () => {
    const adminId = await makeUser("+911111111111", ["BUSINESS"]);
    await db.user.update({
      where: { id: adminId },
      data: { isAdmin: true },
    });
    await createAdPlacement(adminId, {
      surface: "DISCOVERY",
      headline: "Try premium",
      body: "Higher visibility",
      linkUrl: "https://example.com",
    });
    process.env.MONETISATION_ENABLED = "0";
    expect(await listActiveAdPlacements("DISCOVERY")).toEqual([]);
  });
});
