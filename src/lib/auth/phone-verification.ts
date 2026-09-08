import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { phoneSchema } from "@/lib/phone";
import { getOrCreateUserByPhone } from "@/lib/auth/users";

/** How long a verification code stays valid. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;
/** Wrong-code attempts allowed before a challenge is locked. */
const DEFAULT_MAX_ATTEMPTS = 5;

export interface VerificationDeps {
  now?: () => Date;
  /** Returns the plaintext code to send (overridable in tests). */
  generateCode?: () => string;
  /** Delivers the code to the user. The default is a mock SMS sender. */
  sendSms?: (phone: string, code: string) => void | Promise<void>;
  ttlMs?: number;
  maxAttempts?: number;
}

export type CheckReason =
  | "no_pending"
  | "expired"
  | "too_many_attempts"
  | "invalid_code";

export type CheckResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; reason: CheckReason };

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Mock SMS delivery. In a real deployment this would call an SMS provider;
 * for the pilot it just logs so the flow is observable.
 */
function mockSendSms(phone: string, code: string): void {
  console.info(`[mock-sms] verification code for ${phone}: ${code}`);
}

/**
 * Begin phone verification: generate a one-time code, store only its hash with
 * an expiry, and "send" it. Any earlier pending challenge for the same phone is
 * consumed so only the newest code is valid.
 *
 * Returns the normalized phone and expiry. When RSM_EXPOSE_OTP is explicitly
 * set to "1" (local dev / e2e only — never in production), the plaintext
 * `devCode` is included so the mocked flow can be exercised without a real SMS.
 */
export async function startPhoneVerification(
  rawPhone: string,
  deps: VerificationDeps = {},
): Promise<{ phone: string; expiresAt: Date; devCode?: string }> {
  const phone = phoneSchema.parse(rawPhone);
  const now = deps.now?.() ?? new Date();
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const code = deps.generateCode?.() ?? sixDigitCode();
  const send = deps.sendSms ?? mockSendSms;
  const expiresAt = new Date(now.getTime() + ttlMs);

  await db.phoneVerification.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: now },
  });

  await db.phoneVerification.create({
    data: { phone, codeHash: hashCode(phone, code), expiresAt },
  });

  await send(phone, code);

  return {
    phone,
    expiresAt,
    devCode: process.env.RSM_EXPOSE_OTP === "1" ? code : undefined,
  };
}

/**
 * Check a submitted code against the newest pending challenge. On success the
 * challenge is consumed, the user is created (or fetched) and marked verified.
 */
export async function checkPhoneVerification(
  rawPhone: string,
  code: string,
  deps: VerificationDeps = {},
): Promise<CheckResult> {
  const phone = phoneSchema.parse(rawPhone);
  const now = deps.now?.() ?? new Date();
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const challenge = await db.phoneVerification.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) return { ok: false, reason: "no_pending" };

  if (challenge.expiresAt <= now) {
    await db.phoneVerification.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });
    return { ok: false, reason: "expired" };
  }

  if (challenge.attempts >= maxAttempts) {
    return { ok: false, reason: "too_many_attempts" };
  }

  if (challenge.codeHash !== hashCode(phone, code)) {
    // Record the attempt atomically (avoids a lost update under concurrent
    // guesses) but keep the challenge around: once it hits the limit it stays
    // locked (further checks return "too_many_attempts") until it expires or a
    // new code is requested.
    await db.phoneVerification.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid_code" };
  }

  await db.phoneVerification.update({
    where: { id: challenge.id },
    data: { consumedAt: now },
  });

  const { user, created } = await getOrCreateUserByPhone(phone);
  await db.user.update({
    where: { id: user.id },
    data: { phoneVerifiedAt: now },
  });

  return { ok: true, userId: user.id, created };
}
