import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import { blockUser } from "@/lib/blocks/blocks";
import {
  createBulkRequirement,
  closeBulkRequirement,
} from "@/lib/bulk/requirements";
import {
  BulkResponseError,
  cancelBulkResponse,
  getBulkResponseDetail,
  listBulkMessages,
  listResponsesForRequirement,
  listResponsesForSupplier,
  markBulkCompleted,
  markBulkFailed,
  postBulkMessage,
  respondToBulkRequirement,
  revealBulkContact,
  selectBulkResponse,
  withdrawBulkResponse,
} from "@/lib/bulk/responses";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: string[]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles as never);
  return user.id;
}

async function makeRequirement(buyerId: string) {
  return createBulkRequirement(buyerId, {
    material: "PLASTIC",
    minQuantity: 500,
    minQuantityUnit: "KG",
    region: "Bengaluru South",
    qualityNotes: "Clean PET bottles.",
  });
}

function validResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    offeredQuantity: 600,
    offeredQuantityUnit: "KG",
    notes: "I can deliver weekly.",
    ...overrides,
  };
}

describe("respondToBulkRequirement", () => {
  it("creates a PENDING response for a COLLECTOR", async () => {
    const buyer = await makeUser("+14155554000", ["DEALER"]);
    const supplier = await makeUser("+14155554001", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);

    const resp = await respondToBulkRequirement(
      supplier,
      req.id,
      validResponse(),
    );
    expect(resp.status).toBe("PENDING");
    expect(resp.requirementId).toBe(req.id);
    expect(resp.supplierId).toBe(supplier);
    expect(resp.offeredQuantity).toBe(600);
    expect(resp.offeredQuantityUnit).toBe("KG");
    expect(resp.notes).toBe("I can deliver weekly.");
  });

  it("also accepts DEALER as a supplier", async () => {
    const buyer = await makeUser("+14155554010", ["RECYCLER"]);
    const supplier = await makeUser("+14155554011", ["DEALER"]);
    const req = await makeRequirement(buyer);
    await expect(
      respondToBulkRequirement(supplier, req.id, validResponse()),
    ).resolves.toBeDefined();
  });

  it("refuses when the caller lacks a bulk-supplier role", async () => {
    const buyer = await makeUser("+14155554020", ["DEALER"]);
    const household = await makeUser("+14155554021", ["HOUSEHOLD"]);
    const req = await makeRequirement(buyer);
    await expect(
      respondToBulkRequirement(household, req.id, validResponse()),
    ).rejects.toMatchObject({
      code: "not_a_bulk_supplier",
    } as BulkResponseError);
  });

  it("refuses when the caller is suspended", async () => {
    const buyer = await makeUser("+14155554030", ["DEALER"]);
    const supplier = await makeUser("+14155554031", ["COLLECTOR"]);
    await db.user.update({
      where: { id: supplier },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });
    const req = await makeRequirement(buyer);
    await expect(
      respondToBulkRequirement(supplier, req.id, validResponse()),
    ).rejects.toMatchObject({ code: "suspended" } as BulkResponseError);
  });

  it("refuses to respond to a CLOSED requirement", async () => {
    const buyer = await makeUser("+14155554040", ["DEALER"]);
    const supplier = await makeUser("+14155554041", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    await closeBulkRequirement(buyer, req.id);
    await expect(
      respondToBulkRequirement(supplier, req.id, validResponse()),
    ).rejects.toMatchObject({
      code: "requirement_not_active",
    } as BulkResponseError);
  });

  it("refuses to respond to your own requirement", async () => {
    const both = await makeUser("+14155554050", ["DEALER"]);
    const req = await makeRequirement(both);
    await expect(
      respondToBulkRequirement(both, req.id, validResponse()),
    ).rejects.toMatchObject({
      code: "own_requirement",
    } as BulkResponseError);
  });

  it("refuses when either side has blocked the other", async () => {
    const buyer = await makeUser("+14155554060", ["DEALER"]);
    const supplier = await makeUser("+14155554061", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    await blockUser(buyer, supplier);
    await expect(
      respondToBulkRequirement(supplier, req.id, validResponse()),
    ).rejects.toMatchObject({ code: "blocked" } as BulkResponseError);
  });

  it("refuses when the buyer is suspended", async () => {
    const buyer = await makeUser("+14155554070", ["DEALER"]);
    const supplier = await makeUser("+14155554071", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    await db.user.update({
      where: { id: buyer },
      data: { suspendedAt: new Date(), suspensionReason: "test" },
    });
    await expect(
      respondToBulkRequirement(supplier, req.id, validResponse()),
    ).rejects.toMatchObject({
      code: "requirement_not_active",
    } as BulkResponseError);
  });

  it("is idempotent — a repeat response returns the existing row", async () => {
    const buyer = await makeUser("+14155554080", ["DEALER"]);
    const supplier = await makeUser("+14155554081", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const first = await respondToBulkRequirement(
      supplier,
      req.id,
      validResponse({ notes: "First" }),
    );
    const second = await respondToBulkRequirement(
      supplier,
      req.id,
      validResponse({ notes: "Second" }),
    );
    expect(second.id).toBe(first.id);
    expect(second.notes).toBe("First");
  });

  it("rejects invalid input (zero or negative quantity)", async () => {
    const buyer = await makeUser("+14155554090", ["DEALER"]);
    const supplier = await makeUser("+14155554091", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    await expect(
      respondToBulkRequirement(
        supplier,
        req.id,
        validResponse({ offeredQuantity: 0 }),
      ),
    ).rejects.toThrow();
  });
});

describe("withdrawBulkResponse", () => {
  it("moves PENDING → WITHDRAWN", async () => {
    const buyer = await makeUser("+14155554100", ["DEALER"]);
    const supplier = await makeUser("+14155554101", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    const out = await withdrawBulkResponse(supplier, resp.id);
    expect(out.status).toBe("WITHDRAWN");
  });

  it("refuses when the caller is not the supplier", async () => {
    const buyer = await makeUser("+14155554110", ["DEALER"]);
    const supplier = await makeUser("+14155554111", ["COLLECTOR"]);
    const stranger = await makeUser("+14155554112", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await expect(
      withdrawBulkResponse(stranger, resp.id),
    ).rejects.toMatchObject({ code: "not_found" } as BulkResponseError);
  });

  it("refuses to withdraw a response that is already SELECTED", async () => {
    const buyer = await makeUser("+14155554120", ["DEALER"]);
    const supplier = await makeUser("+14155554121", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);
    await expect(
      withdrawBulkResponse(supplier, resp.id),
    ).rejects.toMatchObject({ code: "not_pending" } as BulkResponseError);
  });
});

describe("listResponsesForRequirement", () => {
  it("returns responses to the requirement, newest first, only to the buyer", async () => {
    const buyer = await makeUser("+14155554200", ["DEALER"]);
    const other = await makeUser("+14155554201", ["DEALER"]);
    const s1 = await makeUser("+14155554202", ["COLLECTOR"]);
    const s2 = await makeUser("+14155554203", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const r1 = await respondToBulkRequirement(s1, req.id, validResponse());
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await respondToBulkRequirement(s2, req.id, validResponse());

    const list = await listResponsesForRequirement(buyer, req.id);
    expect(list.map((r) => r.id)).toEqual([r2.id, r1.id]);

    await expect(
      listResponsesForRequirement(other, req.id),
    ).rejects.toMatchObject({ code: "forbidden" } as BulkResponseError);
  });
});

describe("listResponsesForSupplier", () => {
  it("returns the caller's own responses, newest first", async () => {
    const buyer = await makeUser("+14155554300", ["DEALER"]);
    const supplier = await makeUser("+14155554301", ["COLLECTOR"]);
    const req1 = await makeRequirement(buyer);
    const req2 = await makeRequirement(buyer);
    const r1 = await respondToBulkRequirement(supplier, req1.id, validResponse());
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await respondToBulkRequirement(supplier, req2.id, validResponse());
    const list = await listResponsesForSupplier(supplier);
    expect(list.map((r) => r.id)).toEqual([r2.id, r1.id]);
  });
});

describe("selectBulkResponse", () => {
  it("moves the response to SELECTED and stamps expiresAt", async () => {
    const buyer = await makeUser("+14155554400", ["DEALER"]);
    const supplier = await makeUser("+14155554401", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    const out = await selectBulkResponse(buyer, resp.id);
    expect(out.status).toBe("SELECTED");
    expect(out.selectedAt).not.toBeNull();
    expect(out.expiresAt).not.toBeNull();
  });

  it("refuses to select if another response is already SELECTED on the requirement", async () => {
    const buyer = await makeUser("+14155554410", ["DEALER"]);
    const s1 = await makeUser("+14155554411", ["COLLECTOR"]);
    const s2 = await makeUser("+14155554412", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const r1 = await respondToBulkRequirement(s1, req.id, validResponse());
    const r2 = await respondToBulkRequirement(s2, req.id, validResponse());
    await selectBulkResponse(buyer, r1.id);
    await expect(
      selectBulkResponse(buyer, r2.id),
    ).rejects.toMatchObject({
      code: "already_selected",
    } as BulkResponseError);
  });

  it("refuses when the caller is not the buyer on the requirement", async () => {
    const buyer = await makeUser("+14155554420", ["DEALER"]);
    const stranger = await makeUser("+14155554421", ["DEALER"]);
    const supplier = await makeUser("+14155554422", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await expect(
      selectBulkResponse(stranger, resp.id),
    ).rejects.toMatchObject({ code: "not_found" } as BulkResponseError);
  });

  it("refuses when the response is not PENDING", async () => {
    const buyer = await makeUser("+14155554430", ["DEALER"]);
    const supplier = await makeUser("+14155554431", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await withdrawBulkResponse(supplier, resp.id);
    await expect(
      selectBulkResponse(buyer, resp.id),
    ).rejects.toMatchObject({ code: "not_pending" } as BulkResponseError);
  });
});

describe("mutual contact reveal + detail masking", () => {
  it("masks phone until both parties have revealed", async () => {
    const buyer = await makeUser("+14155554500", ["DEALER"]);
    const supplier = await makeUser("+14155554501", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);

    const beforeReveal = await getBulkResponseDetail(buyer, resp.id);
    expect(beforeReveal.buyerPhone).not.toBe("+14155554500");
    expect(beforeReveal.supplierPhone).not.toBe("+14155554501");
    expect(beforeReveal.contactRevealed).toBe(false);

    await revealBulkContact(buyer, resp.id);
    const halfWay = await getBulkResponseDetail(buyer, resp.id);
    expect(halfWay.youRevealed).toBe(true);
    expect(halfWay.counterpartyRevealed).toBe(false);
    expect(halfWay.contactRevealed).toBe(false);

    await revealBulkContact(supplier, resp.id);
    const revealed = await getBulkResponseDetail(supplier, resp.id);
    expect(revealed.contactRevealed).toBe(true);
    expect(revealed.buyerPhone).toBe("+14155554500");
    expect(revealed.supplierPhone).toBe("+14155554501");
  });

  it("refuses to reveal when the response is not SELECTED", async () => {
    const buyer = await makeUser("+14155554510", ["DEALER"]);
    const supplier = await makeUser("+14155554511", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await expect(
      revealBulkContact(supplier, resp.id),
    ).rejects.toMatchObject({ code: "not_selected" } as BulkResponseError);
  });
});

describe("chat", () => {
  it("either party can post a message on a SELECTED response", async () => {
    const buyer = await makeUser("+14155554600", ["DEALER"]);
    const supplier = await makeUser("+14155554601", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);

    await postBulkMessage(buyer, resp.id, "Can you deliver on Tuesday?");
    await postBulkMessage(supplier, resp.id, "Tuesday works.");
    const list = await listBulkMessages(buyer, resp.id);
    expect(list.map((m) => m.body)).toEqual([
      "Can you deliver on Tuesday?",
      "Tuesday works.",
    ]);
  });

  it("refuses an empty message", async () => {
    const buyer = await makeUser("+14155554610", ["DEALER"]);
    const supplier = await makeUser("+14155554611", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);
    await expect(
      postBulkMessage(buyer, resp.id, "  "),
    ).rejects.toMatchObject({ code: "empty_message" } as BulkResponseError);
  });

  it("refuses to post before the response is SELECTED", async () => {
    const buyer = await makeUser("+14155554620", ["DEALER"]);
    const supplier = await makeUser("+14155554621", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await expect(
      postBulkMessage(buyer, resp.id, "Hi"),
    ).rejects.toMatchObject({ code: "not_selected" } as BulkResponseError);
  });
});

describe("outcome", () => {
  it("either party can mark COMPLETED with actual quantity + price", async () => {
    const buyer = await makeUser("+14155554700", ["DEALER"]);
    const supplier = await makeUser("+14155554701", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);
    const out = await markBulkCompleted(buyer, resp.id, {
      actualQuantity: 550,
      finalPrice: 27500,
    });
    expect(out.status).toBe("COMPLETED");
    expect(out.actualQuantity).toBe(550);
    expect(out.finalPrice).toBe(27500);
    expect(out.failureReason).toBeNull();
  });

  it("either party can mark FAILED with a reason", async () => {
    const buyer = await makeUser("+14155554710", ["DEALER"]);
    const supplier = await makeUser("+14155554711", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);
    const out = await markBulkFailed(supplier, resp.id, {
      failureReason: "Supplier could not source enough on time.",
    });
    expect(out.status).toBe("FAILED");
    expect(out.failureReason).toBe("Supplier could not source enough on time.");
  });

  it("either party can cancel a SELECTED response", async () => {
    const buyer = await makeUser("+14155554720", ["DEALER"]);
    const supplier = await makeUser("+14155554721", ["COLLECTOR"]);
    const req = await makeRequirement(buyer);
    const resp = await respondToBulkRequirement(supplier, req.id, validResponse());
    await selectBulkResponse(buyer, resp.id);
    const out = await cancelBulkResponse(supplier, resp.id);
    expect(out.status).toBe("CANCELLED");
  });
});
