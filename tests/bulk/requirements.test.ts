import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser } from "@/lib/blocks/blocks";
import {
  BulkRequirementError,
  closeBulkRequirement,
  createBulkRequirement,
  getBulkRequirement,
  listBulkRequirementsForBuyer,
  searchBulkRequirements,
  updateBulkRequirement,
} from "@/lib/bulk/requirements";
import { updateProfileForUser } from "@/lib/profiles/profiles";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: string[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles as never);
  return user.id;
}

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    material: "PLASTIC",
    minQuantity: 500,
    minQuantityUnit: "KG",
    qualityNotes: "Clean, dry PET bottles preferred.",
    region: "Bengaluru South",
    deadlineAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("createBulkRequirement", () => {
  it("creates an ACTIVE requirement for a DEALER", async () => {
    const buyer = await makeUser("+14155553000", ["DEALER"]);
    const req = await createBulkRequirement(buyer, validInput());

    expect(req.id).toEqual(expect.any(String));
    expect(req.buyerId).toBe(buyer);
    expect(req.status).toBe("ACTIVE");
    expect(req.material).toBe("PLASTIC");
    expect(req.minQuantity).toBe(500);
    expect(req.minQuantityUnit).toBe("KG");
    expect(req.region).toBe("Bengaluru South");
  });

  it("creates for BUSINESS and RECYCLER too", async () => {
    const biz = await makeUser("+14155553001", ["BUSINESS"]);
    const rec = await makeUser("+14155553002", ["RECYCLER"]);
    await expect(createBulkRequirement(biz, validInput())).resolves.toBeDefined();
    await expect(createBulkRequirement(rec, validInput())).resolves.toBeDefined();
  });

  it("refuses when the caller has no bulk-buyer role", async () => {
    const household = await makeUser("+14155553010", ["HOUSEHOLD"]);
    await expect(
      createBulkRequirement(household, validInput()),
    ).rejects.toMatchObject({ code: "not_a_bulk_buyer" } as BulkRequirementError);
  });

  it("refuses when the caller is a plain collector (kabadiwala)", async () => {
    // Collectors respond to bulk requirements — they don't publish them.
    const collector = await makeUser("+14155553011", ["COLLECTOR"]);
    await expect(
      createBulkRequirement(collector, validInput()),
    ).rejects.toMatchObject({ code: "not_a_bulk_buyer" } as BulkRequirementError);
  });

  it("refuses when the caller is suspended", async () => {
    const buyer = await makeUser("+14155553020", ["DEALER"]);
    await db.user.update({
      where: { id: buyer },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });
    await expect(
      createBulkRequirement(buyer, validInput()),
    ).rejects.toMatchObject({ code: "suspended" } as BulkRequirementError);
  });

  it("rejects invalid input (negative quantity)", async () => {
    const buyer = await makeUser("+14155553030", ["DEALER"]);
    await expect(
      createBulkRequirement(buyer, validInput({ minQuantity: -1 })),
    ).rejects.toThrow();
  });

  it("rejects unknown material", async () => {
    const buyer = await makeUser("+14155553031", ["DEALER"]);
    await expect(
      createBulkRequirement(buyer, validInput({ material: "URANIUM" })),
    ).rejects.toThrow();
  });

  it("rejects a deadline in the past", async () => {
    const buyer = await makeUser("+14155553032", ["DEALER"]);
    await expect(
      createBulkRequirement(
        buyer,
        validInput({
          deadlineAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("updateBulkRequirement", () => {
  it("updates the caller's own requirement", async () => {
    const buyer = await makeUser("+14155553100", ["DEALER"]);
    const created = await createBulkRequirement(buyer, validInput());
    const updated = await updateBulkRequirement(
      buyer,
      created.id,
      validInput({ minQuantity: 1000, region: "Bengaluru North" }),
    );
    expect(updated.minQuantity).toBe(1000);
    expect(updated.region).toBe("Bengaluru North");
  });

  it("refuses to update someone else's requirement", async () => {
    const owner = await makeUser("+14155553110", ["DEALER"]);
    const stranger = await makeUser("+14155553111", ["DEALER"]);
    const created = await createBulkRequirement(owner, validInput());
    await expect(
      updateBulkRequirement(stranger, created.id, validInput()),
    ).rejects.toMatchObject({ code: "forbidden" } as BulkRequirementError);
  });

  it("refuses when the requirement does not exist", async () => {
    const buyer = await makeUser("+14155553120", ["DEALER"]);
    await expect(
      updateBulkRequirement(buyer, "does-not-exist", validInput()),
    ).rejects.toMatchObject({ code: "not_found" } as BulkRequirementError);
  });

  it("refuses to update a CLOSED requirement", async () => {
    const buyer = await makeUser("+14155553130", ["DEALER"]);
    const created = await createBulkRequirement(buyer, validInput());
    await closeBulkRequirement(buyer, created.id);
    await expect(
      updateBulkRequirement(buyer, created.id, validInput()),
    ).rejects.toMatchObject({ code: "closed" } as BulkRequirementError);
  });
});

describe("closeBulkRequirement", () => {
  it("moves ACTIVE -> CLOSED and stamps closedAt", async () => {
    const buyer = await makeUser("+14155553200", ["DEALER"]);
    const created = await createBulkRequirement(buyer, validInput());
    const closed = await closeBulkRequirement(buyer, created.id);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();
  });

  it("refuses to close someone else's requirement", async () => {
    const owner = await makeUser("+14155553210", ["DEALER"]);
    const stranger = await makeUser("+14155553211", ["DEALER"]);
    const created = await createBulkRequirement(owner, validInput());
    await expect(
      closeBulkRequirement(stranger, created.id),
    ).rejects.toMatchObject({ code: "forbidden" } as BulkRequirementError);
  });
});

describe("listBulkRequirementsForBuyer", () => {
  it("returns only that buyer's requirements, most recent first", async () => {
    const a = await makeUser("+14155553300", ["DEALER"]);
    const b = await makeUser("+14155553301", ["DEALER"]);
    const first = await createBulkRequirement(a, validInput({ region: "R1" }));
    await new Promise((r) => setTimeout(r, 5));
    const second = await createBulkRequirement(a, validInput({ region: "R2" }));
    await createBulkRequirement(b, validInput({ region: "Ignored" }));

    const list = await listBulkRequirementsForBuyer(a);
    expect(list.map((r) => r.id)).toEqual([second.id, first.id]);
  });
});

describe("getBulkRequirement", () => {
  it("returns the requirement with the buyer's verification signals attached", async () => {
    const buyer = await makeUser("+14155553400", ["DEALER"]);
    await updateProfileForUser(buyer, {
      displayName: "Acme Recycling",
      organisationName: "Acme Recycling Pvt Ltd",
      registrationId: "GST-29XYZ1234A1Z5",
    });
    const created = await createBulkRequirement(buyer, validInput());

    const detail = await getBulkRequirement(created.id);
    expect(detail?.id).toBe(created.id);
    expect(detail?.buyer.organisationName).toBe("Acme Recycling Pvt Ltd");
    expect(detail?.buyer.registrationId).toBe("GST-29XYZ1234A1Z5");
    expect(detail?.buyer.displayName).toBe("Acme Recycling");
    expect(detail?.buyer.roles).toContain("DEALER");
    // Aggregated reputation is present so suppliers can gauge risk before contact.
    expect(detail?.buyer.reputation).toBeDefined();
  });

  it("returns null when the id is unknown", async () => {
    const detail = await getBulkRequirement("does-not-exist");
    expect(detail).toBeNull();
  });
});

describe("searchBulkRequirements", () => {
  it("returns ACTIVE requirements ranked by most recent", async () => {
    const buyer = await makeUser("+14155553500", ["DEALER"]);
    const first = await createBulkRequirement(buyer, validInput({ region: "AA" }));
    await new Promise((r) => setTimeout(r, 5));
    const second = await createBulkRequirement(buyer, validInput({ region: "BB" }));

    const results = await searchBulkRequirements({});
    const ids = results.map((r) => r.id);
    expect(ids).toEqual([second.id, first.id]);
  });

  it("filters by material", async () => {
    const buyer = await makeUser("+14155553510", ["DEALER"]);
    await createBulkRequirement(buyer, validInput({ material: "PLASTIC" }));
    const paperReq = await createBulkRequirement(
      buyer,
      validInput({ material: "PAPER" }),
    );
    const results = await searchBulkRequirements({ material: "PAPER" });
    expect(results.map((r) => r.id)).toEqual([paperReq.id]);
  });

  it("filters by minQuantity + unit (buyer's requirement must not exceed what supplier can deliver)", async () => {
    const buyer = await makeUser("+14155553520", ["DEALER"]);
    // Supplier can deliver 100kg. They want requirements asking for <= 100kg
    // in matching unit.
    await createBulkRequirement(
      buyer,
      validInput({ minQuantity: 50, minQuantityUnit: "KG" }),
    );
    await createBulkRequirement(
      buyer,
      validInput({ minQuantity: 500, minQuantityUnit: "KG" }),
    );
    await createBulkRequirement(
      buyer,
      validInput({ minQuantity: 50, minQuantityUnit: "PIECES" }),
    );

    const results = await searchBulkRequirements({
      supplyQuantity: 100,
      supplyQuantityUnit: "KG",
    });
    expect(results.map((r) => r.minQuantity)).toEqual([50]);
    expect(results.every((r) => r.minQuantityUnit === "KG")).toBe(true);
  });

  it("filters by region substring, case-insensitive", async () => {
    const buyer = await makeUser("+14155553530", ["DEALER"]);
    const south = await createBulkRequirement(
      buyer,
      validInput({ region: "Bengaluru South" }),
    );
    await createBulkRequirement(buyer, validInput({ region: "Delhi NCR" }));

    const results = await searchBulkRequirements({ region: "bengaluru" });
    expect(results.map((r) => r.id)).toEqual([south.id]);
  });

  it("filters by buyer role (seller type)", async () => {
    const dealer = await makeUser("+14155553540", ["DEALER"]);
    const recycler = await makeUser("+14155553541", ["RECYCLER"]);
    const dealerReq = await createBulkRequirement(dealer, validInput());
    const recyclerReq = await createBulkRequirement(recycler, validInput());

    const results = await searchBulkRequirements({ buyerRole: "RECYCLER" });
    expect(results.map((r) => r.id)).toEqual([recyclerReq.id]);

    const dealerResults = await searchBulkRequirements({ buyerRole: "DEALER" });
    expect(dealerResults.map((r) => r.id)).toEqual([dealerReq.id]);
  });

  it("excludes CLOSED requirements", async () => {
    const buyer = await makeUser("+14155553550", ["DEALER"]);
    const open = await createBulkRequirement(buyer, validInput());
    const willClose = await createBulkRequirement(buyer, validInput());
    await closeBulkRequirement(buyer, willClose.id);

    const results = await searchBulkRequirements({});
    expect(results.map((r) => r.id)).toEqual([open.id]);
  });

  it("excludes requirements from suspended buyers", async () => {
    const active = await makeUser("+14155553560", ["DEALER"]);
    const suspended = await makeUser("+14155553561", ["DEALER"]);
    const kept = await createBulkRequirement(active, validInput());
    await createBulkRequirement(suspended, validInput());
    await db.user.update({
      where: { id: suspended },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });

    const results = await searchBulkRequirements({});
    expect(results.map((r) => r.id)).toEqual([kept.id]);
  });

  it("excludes requirements from either side of a block, when viewerId given", async () => {
    const viewer = await makeUser("+14155553570", ["COLLECTOR"]);
    const blocked = await makeUser("+14155553571", ["DEALER"]);
    const blocker = await makeUser("+14155553572", ["DEALER"]);
    const kept = await makeUser("+14155553573", ["DEALER"]);

    await createBulkRequirement(blocked, validInput());
    await createBulkRequirement(blocker, validInput());
    const keptReq = await createBulkRequirement(kept, validInput());

    await blockUser(viewer, blocked);
    await blockUser(blocker, viewer);

    const results = await searchBulkRequirements({ viewerId: viewer });
    expect(results.map((r) => r.id)).toEqual([keptReq.id]);
  });

  it("excludes requirements whose deadline has passed", async () => {
    const buyer = await makeUser("+14155553580", ["DEALER"]);
    // Create then rewrite the deadline into the past (bypasses schema validation
    // which forbids past deadlines on the write path).
    const soon = await createBulkRequirement(
      buyer,
      validInput({
        deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    );
    const expired = await createBulkRequirement(buyer, validInput());
    await db.bulkRequirement.update({
      where: { id: expired.id },
      data: { deadlineAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const results = await searchBulkRequirements({});
    expect(results.map((r) => r.id)).toEqual([soon.id]);
  });

  it("attaches verification signals so a supplier can gauge risk before contact", async () => {
    const buyer = await makeUser("+14155553590", ["DEALER"]);
    await updateProfileForUser(buyer, {
      displayName: "Blue Dot Dealers",
      organisationName: "Blue Dot Dealers LLP",
      registrationId: "GST-27ABCDE9876Q1Z2",
    });
    await createBulkRequirement(buyer, validInput());

    const [result] = await searchBulkRequirements({});
    expect(result.buyer.displayName).toBe("Blue Dot Dealers");
    expect(result.buyer.organisationName).toBe("Blue Dot Dealers LLP");
    expect(result.buyer.registrationId).toBe("GST-27ABCDE9876Q1Z2");
    expect(result.buyer.roles).toContain("DEALER");
  });
});
