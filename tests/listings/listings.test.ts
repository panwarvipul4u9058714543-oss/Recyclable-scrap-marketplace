import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  ListingError,
  closeListing,
  createListing,
  getListingForSeller,
  listSellerListings,
  pauseListing,
  resumeListing,
  updateListing,
} from "@/lib/listings/listings";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

// Build a verified seller with the given roles and return their id.
async function makeSeller(
  phone: string,
  roles: ("HOUSEHOLD" | "BUSINESS" | "COLLECTOR")[] = ["HOUSEHOLD"],
) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles);
  return user.id;
}

const validInput = {
  sellerType: "HOUSEHOLD" as const,
  materialCategory: "PLASTIC" as const,
  title: "Bag of clean PET bottles",
  description: "About a month of household bottles.",
  photos: ["https://example.com/photo1.jpg"],
  quantityMin: 5,
  quantityMax: 8,
  quantityUnit: "KG" as const,
  locality: "Koramangala, Bengaluru",
  availability: "WEEKENDS" as const,
};

describe("createListing", () => {
  it("creates an ACTIVE listing with the supplied fields", async () => {
    const sellerId = await makeSeller("+14155550100");

    const listing = await createListing(sellerId, validInput);

    expect(listing.id).toBeTruthy();
    expect(listing.status).toBe("ACTIVE");
    expect(listing.materialCategory).toBe("PLASTIC");
    expect(listing.photos).toEqual(["https://example.com/photo1.jpg"]);
    expect(listing.quantityMin).toBe(5);
    expect(listing.quantityMax).toBe(8);
    expect(listing.sellerId).toBe(sellerId);
  });

  it("rejects a seller type the user does not hold", async () => {
    const sellerId = await makeSeller("+14155550100", ["HOUSEHOLD"]);

    await expect(
      createListing(sellerId, { ...validInput, sellerType: "BUSINESS" }),
    ).rejects.toMatchObject({ code: "invalid_seller_type" });
  });

  it("rejects a user with no seller role", async () => {
    const sellerId = await makeSeller("+14155550100", ["COLLECTOR"]);

    await expect(createListing(sellerId, validInput)).rejects.toBeInstanceOf(
      ListingError,
    );
  });

  it("rejects a quantity range whose max is below its min", async () => {
    const sellerId = await makeSeller("+14155550100");

    await expect(
      createListing(sellerId, { ...validInput, quantityMin: 10, quantityMax: 2 }),
    ).rejects.toThrow();
  });

  it("rejects a listing with no photos", async () => {
    const sellerId = await makeSeller("+14155550100");

    await expect(
      createListing(sellerId, { ...validInput, photos: [] }),
    ).rejects.toThrow();
  });

  it("rejects an unknown material category", async () => {
    const sellerId = await makeSeller("+14155550100");

    await expect(
      createListing(sellerId, { ...validInput, materialCategory: "URANIUM" }),
    ).rejects.toThrow();
  });
});

describe("listSellerListings", () => {
  it("returns only the seller's own listings, newest first", async () => {
    const a = await makeSeller("+14155550100");
    const b = await makeSeller("+14155550200");

    await createListing(a, { ...validInput, title: "First" });
    await createListing(a, { ...validInput, title: "Second" });
    await createListing(b, { ...validInput, title: "Someone else" });

    const forA = await listSellerListings(a);
    expect(forA).toHaveLength(2);
    expect(forA.map((l) => l.title)).toEqual(["Second", "First"]);
  });
});

describe("updateListing", () => {
  it("updates fields of an owned listing", async () => {
    const sellerId = await makeSeller("+14155550100");
    const listing = await createListing(sellerId, validInput);

    const updated = await updateListing(sellerId, listing.id, {
      ...validInput,
      title: "Updated title",
      quantityMax: 12,
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.quantityMax).toBe(12);
  });

  it("refuses to update a listing owned by someone else", async () => {
    const owner = await makeSeller("+14155550100");
    const other = await makeSeller("+14155550200");
    const listing = await createListing(owner, validInput);

    await expect(
      updateListing(other, listing.id, { ...validInput, title: "Hijack" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses to edit a closed listing", async () => {
    const sellerId = await makeSeller("+14155550100");
    const listing = await createListing(sellerId, validInput);
    await closeListing(sellerId, listing.id);

    await expect(
      updateListing(sellerId, listing.id, { ...validInput, title: "Nope" }),
    ).rejects.toMatchObject({ code: "closed" });
  });
});

describe("status transitions", () => {
  it("pauses and resumes an active listing", async () => {
    const sellerId = await makeSeller("+14155550100");
    const listing = await createListing(sellerId, validInput);

    const paused = await pauseListing(sellerId, listing.id);
    expect(paused.status).toBe("PAUSED");

    const resumed = await resumeListing(sellerId, listing.id);
    expect(resumed.status).toBe("ACTIVE");
  });

  it("closes a listing and forbids further transitions", async () => {
    const sellerId = await makeSeller("+14155550100");
    const listing = await createListing(sellerId, validInput);

    const closed = await closeListing(sellerId, listing.id);
    expect(closed.status).toBe("CLOSED");

    await expect(pauseListing(sellerId, listing.id)).rejects.toMatchObject({
      code: "invalid_transition",
    });
  });

  it("rejects pausing a listing that is not active", async () => {
    const sellerId = await makeSeller("+14155550100");
    const listing = await createListing(sellerId, validInput);
    await pauseListing(sellerId, listing.id);

    await expect(pauseListing(sellerId, listing.id)).rejects.toMatchObject({
      code: "invalid_transition",
    });
  });

  it("forbids transitions on someone else's listing", async () => {
    const owner = await makeSeller("+14155550100");
    const other = await makeSeller("+14155550200");
    const listing = await createListing(owner, validInput);

    await expect(closeListing(other, listing.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("getListingForSeller", () => {
  it("returns an owned listing and rejects a non-owner", async () => {
    const owner = await makeSeller("+14155550100");
    const other = await makeSeller("+14155550200");
    const listing = await createListing(owner, validInput);

    const loaded = await getListingForSeller(owner, listing.id);
    expect(loaded.id).toBe(listing.id);

    await expect(getListingForSeller(other, listing.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("rejects an unknown listing id", async () => {
    const owner = await makeSeller("+14155550100");
    await expect(
      getListingForSeller(owner, "does-not-exist"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
