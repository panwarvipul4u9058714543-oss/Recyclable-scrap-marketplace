import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateUserByPhone, setUserRoles } from "@/lib/auth/users";
import {
  ModerationError,
  dismissReport,
  isUserSuspended,
  listOpenReportsForAdmin,
  reinstateUser,
  resolveReport,
  suspendUser,
} from "@/lib/moderation/moderation";
import { reportListing, reportUser } from "@/lib/reports/reports";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(phone: string, roles: string[] = ["HOUSEHOLD"]) {
  const { user } = await getOrCreateUserByPhone(phone);
  await setUserRoles(user.id, roles as never);
  return user.id;
}

async function makeAdmin(phone: string) {
  const id = await makeUser(phone);
  await db.user.update({ where: { id }, data: { isAdmin: true } });
  return id;
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

describe("listOpenReportsForAdmin", () => {
  it("refuses a non-admin caller", async () => {
    const nonAdmin = await makeUser("+14155551000");
    await expect(listOpenReportsForAdmin(nonAdmin)).rejects.toBeInstanceOf(
      ModerationError,
    );
  });

  it("returns open reports, newest first, for an admin", async () => {
    const admin = await makeAdmin("+14155551001");
    const seller = await makeUser("+14155551002");
    const reporter = await makeUser("+14155551003");
    const listing = await makeListing(seller);

    await reportListing(reporter, listing.id, { reason: "spam" });
    await reportUser(reporter, seller, { reason: "harassment" });

    const rows = await listOpenReportsForAdmin(admin);
    expect(rows).toHaveLength(2);
    // newest first
    expect(rows[0].reason).toBe("harassment");
    expect(rows[1].reason).toBe("spam");
  });
});

describe("resolveReport / dismissReport", () => {
  it("resolves an open report and stamps the reviewer, timestamp and note", async () => {
    const admin = await makeAdmin("+14155551010");
    const seller = await makeUser("+14155551011");
    const reporter = await makeUser("+14155551012");
    const listing = await makeListing(seller);
    const report = await reportListing(reporter, listing.id, {
      reason: "hazardous",
    });

    const updated = await resolveReport(admin, report.id, {
      note: "Listing removed and seller warned.",
    });

    expect(updated.status).toBe("RESOLVED");
    expect(updated.reviewedById).toBe(admin);
    expect(updated.reviewedAt).toBeInstanceOf(Date);
    expect(updated.reviewNote).toBe("Listing removed and seller warned.");
  });

  it("dismisses an open report", async () => {
    const admin = await makeAdmin("+14155551020");
    const seller = await makeUser("+14155551021");
    const reporter = await makeUser("+14155551022");
    const listing = await makeListing(seller);
    const report = await reportListing(reporter, listing.id, { reason: "spam" });

    const updated = await dismissReport(admin, report.id, {});
    expect(updated.status).toBe("DISMISSED");
    expect(updated.reviewedById).toBe(admin);
  });

  it("refuses a non-admin caller", async () => {
    const nonAdmin = await makeUser("+14155551030");
    const seller = await makeUser("+14155551031");
    const reporter = await makeUser("+14155551032");
    const listing = await makeListing(seller);
    const report = await reportListing(reporter, listing.id, { reason: "spam" });

    await expect(
      resolveReport(nonAdmin, report.id, {}),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("refuses to review a report that is already decided", async () => {
    const admin = await makeAdmin("+14155551040");
    const seller = await makeUser("+14155551041");
    const reporter = await makeUser("+14155551042");
    const listing = await makeListing(seller);
    const report = await reportListing(reporter, listing.id, { reason: "spam" });

    await resolveReport(admin, report.id, {});
    await expect(
      dismissReport(admin, report.id, {}),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("refuses to review a report that does not exist", async () => {
    const admin = await makeAdmin("+14155551050");
    await expect(
      resolveReport(admin, "nope", {}),
    ).rejects.toBeInstanceOf(ModerationError);
  });
});

describe("suspendUser / reinstateUser", () => {
  it("suspends an active user and records the reason", async () => {
    const admin = await makeAdmin("+14155551100");
    const target = await makeUser("+14155551101");

    const before = await isUserSuspended(target);
    expect(before).toBe(false);

    const updated = await suspendUser(admin, target, {
      reason: "Repeated no-shows across three connections.",
    });

    expect(updated.suspendedAt).toBeInstanceOf(Date);
    expect(updated.suspensionReason).toBe(
      "Repeated no-shows across three connections.",
    );
    expect(await isUserSuspended(target)).toBe(true);
  });

  it("refuses a non-admin caller", async () => {
    const nonAdmin = await makeUser("+14155551110");
    const target = await makeUser("+14155551111");
    await expect(
      suspendUser(nonAdmin, target, { reason: "unauthorized" }),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("refuses to suspend yourself", async () => {
    const admin = await makeAdmin("+14155551120");
    await expect(
      suspendUser(admin, admin, { reason: "no" }),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("refuses to suspend a user that does not exist", async () => {
    const admin = await makeAdmin("+14155551130");
    await expect(
      suspendUser(admin, "nobody", { reason: "no" }),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("refuses to suspend an already-suspended user", async () => {
    const admin = await makeAdmin("+14155551140");
    const target = await makeUser("+14155551141");
    await suspendUser(admin, target, { reason: "first" });
    await expect(
      suspendUser(admin, target, { reason: "second" }),
    ).rejects.toBeInstanceOf(ModerationError);
  });

  it("reinstates a suspended user and clears the reason", async () => {
    const admin = await makeAdmin("+14155551150");
    const target = await makeUser("+14155551151");
    await suspendUser(admin, target, { reason: "temporary" });

    const updated = await reinstateUser(admin, target);
    expect(updated.suspendedAt).toBeNull();
    expect(updated.suspensionReason).toBeNull();
    expect(await isUserSuspended(target)).toBe(false);
  });

  it("refuses to reinstate a user who is not suspended", async () => {
    const admin = await makeAdmin("+14155551160");
    const target = await makeUser("+14155551161");
    await expect(
      reinstateUser(admin, target),
    ).rejects.toBeInstanceOf(ModerationError);
  });
});
