import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  computeReputation,
  getProfileForUser,
  getPublicProfile,
  updateProfileForUser,
} from "@/lib/profiles/profiles";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(
  phone: string,
  roles: ("HOUSEHOLD" | "BUSINESS" | "COLLECTOR" | "DEALER" | "RECYCLER")[] = [
    "COLLECTOR",
  ],
) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

describe("getProfileForUser", () => {
  it("returns an empty profile when the user has never edited one", async () => {
    const userId = await makeUser("+14155550110");

    const profile = await getProfileForUser(userId);

    expect(profile.userId).toBe(userId);
    expect(profile.displayName).toBeNull();
    expect(profile.bio).toBeNull();
    expect(profile.organisationName).toBeNull();
    expect(profile.registrationId).toBeNull();
    expect(profile.serviceAreaLocality).toBeNull();
    expect(profile.serviceAreaRadiusKm).toBeNull();
    expect(profile.acceptedMaterials).toEqual([]);
  });
});

describe("updateProfileForUser", () => {
  it("creates a profile row on first update and returns the new values", async () => {
    const userId = await makeUser("+14155550111", ["COLLECTOR"]);

    const profile = await updateProfileForUser(userId, {
      displayName: "Ravi K.",
      bio: "Collect PET and paper twice a week.",
      serviceAreaLocality: "HSR Layout, Bengaluru",
      serviceAreaRadiusKm: 5,
      acceptedMaterials: ["PLASTIC", "PAPER"],
    });

    expect(profile.displayName).toBe("Ravi K.");
    expect(profile.bio).toBe("Collect PET and paper twice a week.");
    expect(profile.serviceAreaLocality).toBe("HSR Layout, Bengaluru");
    expect(profile.serviceAreaRadiusKm).toBe(5);
    expect(profile.acceptedMaterials).toEqual(["PLASTIC", "PAPER"]);

    const row = await db.profile.findUnique({ where: { userId } });
    expect(row).not.toBeNull();
  });

  it("upserts subsequent updates in place instead of creating another row", async () => {
    const userId = await makeUser("+14155550112", ["BUSINESS"]);

    await updateProfileForUser(userId, {
      organisationName: "Green Cafe",
      registrationId: "GST29ABCDE1234F1Z5",
    });
    const updated = await updateProfileForUser(userId, {
      organisationName: "Green Cafe (HQ)",
      registrationId: "GST29ABCDE1234F1Z5",
      bio: "We hand over sorted cardboard weekly.",
    });

    expect(updated.organisationName).toBe("Green Cafe (HQ)");
    expect(updated.bio).toBe("We hand over sorted cardboard weekly.");

    const count = await db.profile.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it("normalises empty strings to null so the field is cleared", async () => {
    const userId = await makeUser("+14155550113");

    await updateProfileForUser(userId, { displayName: "Temp Name" });
    const cleared = await updateProfileForUser(userId, { displayName: "" });

    expect(cleared.displayName).toBeNull();
  });

  it("leaves untouched fields alone on a partial update", async () => {
    const userId = await makeUser("+14155550113", ["COLLECTOR"]);

    await updateProfileForUser(userId, {
      displayName: "Ravi K.",
      serviceAreaLocality: "HSR Layout",
    });
    const patched = await updateProfileForUser(userId, {
      bio: "Two pickups a week.",
    });

    expect(patched.displayName).toBe("Ravi K.");
    expect(patched.serviceAreaLocality).toBe("HSR Layout");
    expect(patched.bio).toBe("Two pickups a week.");
  });

  it("rejects a display name shorter than two characters", async () => {
    const userId = await makeUser("+14155550114");
    await expect(
      updateProfileForUser(userId, { displayName: "A" }),
    ).rejects.toThrow();
  });

  it("rejects a bio longer than 500 characters", async () => {
    const userId = await makeUser("+14155550115");
    await expect(
      updateProfileForUser(userId, { bio: "x".repeat(501) }),
    ).rejects.toThrow();
  });

  it("rejects a service-area radius outside 0.5..500 km", async () => {
    const userId = await makeUser("+14155550116");
    await expect(
      updateProfileForUser(userId, { serviceAreaRadiusKm: 0.1 }),
    ).rejects.toThrow();
    await expect(
      updateProfileForUser(userId, { serviceAreaRadiusKm: 501 }),
    ).rejects.toThrow();
  });

  it("rejects an unknown material category in acceptedMaterials", async () => {
    const userId = await makeUser("+14155550117");
    await expect(
      updateProfileForUser(userId, {
        acceptedMaterials: ["PLASTIC", "NOT_A_MATERIAL"] as unknown as never,
      }),
    ).rejects.toThrow();
  });

  it("de-duplicates acceptedMaterials", async () => {
    const userId = await makeUser("+14155550118");
    const profile = await updateProfileForUser(userId, {
      acceptedMaterials: ["PLASTIC", "PLASTIC", "PAPER"],
    });
    expect(profile.acceptedMaterials).toEqual(["PLASTIC", "PAPER"]);
  });
});

describe("getPublicProfile", () => {
  it("returns null for an unknown user", async () => {
    const result = await getPublicProfile("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns the profile fields, roles and reputation, but not the phone", async () => {
    const userId = await makeUser("+14155550119", ["COLLECTOR"]);
    await updateProfileForUser(userId, {
      displayName: "Meera P.",
      serviceAreaLocality: "Indiranagar",
      acceptedMaterials: ["METAL"],
    });

    const publicView = await getPublicProfile(userId);

    expect(publicView).not.toBeNull();
    expect(publicView!.displayName).toBe("Meera P.");
    expect(publicView!.roles).toEqual(["COLLECTOR"]);
    expect(publicView!.acceptedMaterials).toEqual(["METAL"]);
    expect(publicView!.reputation).toBeDefined();
    expect(publicView!.reputation.memberSince).toBeInstanceOf(Date);
    // The public profile must never leak the phone number.
    expect(Object.keys(publicView!)).not.toContain("phone");
  });
});

describe("computeReputation", () => {
  it("counts completed connections separately for seller and collector", async () => {
    const sellerId = await makeUser("+14155550130", ["HOUSEHOLD"]);
    const collectorId = await makeUser("+14155550131", ["COLLECTOR"]);

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
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.connection.create({
      data: {
        listingId: listing.id,
        sellerId,
        collectorId,
        status: "COMPLETED",
        expiresAt: future,
      },
    });
    await db.connection.create({
      data: {
        listingId: listing.id,
        sellerId,
        collectorId,
        status: "FAILED",
        expiresAt: future,
      },
    });
    await db.connection.create({
      data: {
        listingId: listing.id,
        sellerId,
        collectorId,
        status: "CANCELLED",
        expiresAt: future,
      },
    });

    const sellerRep = await computeReputation(sellerId);
    const collectorRep = await computeReputation(collectorId);

    expect(sellerRep.completedAsSeller).toBe(1);
    expect(sellerRep.completedAsCollector).toBe(0);
    expect(sellerRep.failed).toBe(1);
    expect(sellerRep.cancelledOrExpired).toBe(1);

    expect(collectorRep.completedAsSeller).toBe(0);
    expect(collectorRep.completedAsCollector).toBe(1);
    expect(collectorRep.failed).toBe(1);
    expect(collectorRep.cancelledOrExpired).toBe(1);
  });
});
