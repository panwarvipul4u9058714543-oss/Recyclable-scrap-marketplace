import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  ReportError,
  listOpenReports,
  reportListing,
  reportUser,
} from "@/lib/reports/reports";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, ["HOUSEHOLD"]);
  return user.id;
}

async function makeListing(sellerId: string) {
  return db.listing.create({
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
}

describe("reportListing", () => {
  it("records an OPEN report against a listing", async () => {
    const seller = await makeUser("+14155550200");
    const reporter = await makeUser("+14155550201");
    const listing = await makeListing(seller);

    const report = await reportListing(reporter, listing.id, {
      reason: "hazardous",
      details: "Looks like paint tins in the second photo.",
    });

    expect(report.status).toBe("OPEN");
    expect(report.reporterId).toBe(reporter);
    expect(report.targetType).toBe("LISTING");
    expect(report.targetId).toBe(listing.id);
    expect(report.reason).toBe("hazardous");
  });

  it("refuses to report the reporter's own listing", async () => {
    const seller = await makeUser("+14155550202");
    const listing = await makeListing(seller);

    await expect(
      reportListing(seller, listing.id, { reason: "spam" }),
    ).rejects.toBeInstanceOf(ReportError);
  });

  it("refuses to report a listing that does not exist", async () => {
    const reporter = await makeUser("+14155550203");
    await expect(
      reportListing(reporter, "nope", { reason: "spam" }),
    ).rejects.toBeInstanceOf(ReportError);
  });

  it("rejects an empty reason", async () => {
    const seller = await makeUser("+14155550204");
    const reporter = await makeUser("+14155550205");
    const listing = await makeListing(seller);
    await expect(
      reportListing(reporter, listing.id, { reason: "   " }),
    ).rejects.toThrow();
  });
});

describe("reportUser", () => {
  it("records an OPEN report against another user", async () => {
    const reporter = await makeUser("+14155550210");
    const target = await makeUser("+14155550211");

    const report = await reportUser(reporter, target, {
      reason: "harassment",
      details: "Sent abusive messages after cancellation.",
    });

    expect(report.status).toBe("OPEN");
    expect(report.targetType).toBe("USER");
    expect(report.targetId).toBe(target);
  });

  it("refuses to report yourself", async () => {
    const reporter = await makeUser("+14155550212");
    await expect(
      reportUser(reporter, reporter, { reason: "test" }),
    ).rejects.toBeInstanceOf(ReportError);
  });

  it("refuses to report a user that does not exist", async () => {
    const reporter = await makeUser("+14155550213");
    await expect(
      reportUser(reporter, "nobody", { reason: "test" }),
    ).rejects.toBeInstanceOf(ReportError);
  });
});

describe("listOpenReports", () => {
  it("returns OPEN reports newest first, skipping resolved ones", async () => {
    const seller = await makeUser("+14155550220");
    const reporter = await makeUser("+14155550221");
    const listing = await makeListing(seller);

    const r1 = await reportListing(reporter, listing.id, { reason: "one" });
    const r2 = await reportUser(reporter, seller, { reason: "two" });

    await db.report.update({
      where: { id: r1.id },
      data: { status: "REVIEWED", reviewedById: seller, reviewedAt: new Date() },
    });

    const open = await listOpenReports();
    expect(open.map((r) => r.id)).toEqual([r2.id]);
  });
});
