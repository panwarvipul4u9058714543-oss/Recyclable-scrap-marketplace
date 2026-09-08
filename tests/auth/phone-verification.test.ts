import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  startPhoneVerification,
  checkPhoneVerification,
} from "@/lib/auth/phone-verification";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
});

describe("startPhoneVerification", () => {
  it("normalizes the phone and stores a hashed, expiring challenge", async () => {
    const sendSms = vi.fn();
    const now = new Date("2026-01-01T00:00:00Z");

    const result = await startPhoneVerification("+1 (415) 555-0100", {
      now: () => now,
      generateCode: () => "123456",
      sendSms,
      ttlMs: 10 * 60 * 1000,
    });

    expect(result.phone).toBe("+14155550100");
    expect(result.expiresAt).toEqual(new Date("2026-01-01T00:10:00Z"));
    expect(sendSms).toHaveBeenCalledWith("+14155550100", "123456");

    const rows = await db.phoneVerification.findMany();
    expect(rows).toHaveLength(1);
    // The plaintext code must never be stored.
    expect(rows[0].codeHash).not.toContain("123456");
  });

  it("rejects an invalid phone number", async () => {
    await expect(startPhoneVerification("nope")).rejects.toThrow();
  });

  it("consumes any earlier pending challenge for the same phone", async () => {
    await startPhoneVerification("+14155550100", {
      generateCode: () => "111111",
    });
    await startPhoneVerification("+14155550100", {
      generateCode: () => "222222",
    });

    const pending = await db.phoneVerification.findMany({
      where: { phone: "+14155550100", consumedAt: null },
    });
    expect(pending).toHaveLength(1);
  });
});

describe("checkPhoneVerification", () => {
  const start = (code: string) =>
    startPhoneVerification("+14155550100", { generateCode: () => code });

  it("verifies a correct code and creates the user", async () => {
    await start("123456");

    const result = await checkPhoneVerification("+14155550100", "123456");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.created).toBe(true);

    const user = await db.user.findUnique({ where: { id: result.userId } });
    expect(user?.phone).toBe("+14155550100");
    expect(user?.phoneVerifiedAt).not.toBeNull();
  });

  it("returns the existing user on a repeat verification", async () => {
    await start("123456");
    const first = await checkPhoneVerification("+14155550100", "123456");

    await start("654321");
    const second = await checkPhoneVerification("+14155550100", "654321");

    if (!first.ok || !second.ok) throw new Error("expected ok");
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
  });

  it("rejects a wrong code and records the attempt", async () => {
    await start("123456");

    const result = await checkPhoneVerification("+14155550100", "000000");

    expect(result).toEqual({ ok: false, reason: "invalid_code" });
    const row = await db.phoneVerification.findFirst({
      where: { phone: "+14155550100" },
    });
    expect(row?.attempts).toBe(1);
  });

  it("locks out after too many attempts", async () => {
    await start("123456");
    for (let i = 0; i < 5; i++) {
      await checkPhoneVerification("+14155550100", "000000");
    }

    // Even the correct code is refused once locked.
    const result = await checkPhoneVerification("+14155550100", "123456");
    expect(result).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("rejects an expired code", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    await startPhoneVerification("+14155550100", {
      now: () => t0,
      generateCode: () => "123456",
      ttlMs: 60 * 1000,
    });

    const later = new Date("2026-01-01T00:02:00Z");
    const result = await checkPhoneVerification("+14155550100", "123456", {
      now: () => later,
    });

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("reports when there is no pending challenge", async () => {
    const result = await checkPhoneVerification("+14155550100", "123456");
    expect(result).toEqual({ ok: false, reason: "no_pending" });
  });
});
