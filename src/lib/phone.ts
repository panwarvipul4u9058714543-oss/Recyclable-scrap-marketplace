import { z } from "zod";

/**
 * Phone numbers are stored and compared in a normalized E.164-ish form:
 * an optional leading "+" followed by 8–15 digits. This keeps the pilot simple
 * while still rejecting obvious junk.
 */
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

/** Strip spaces, dashes and parentheses before validating. */
export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, "");
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => PHONE_RE.test(v), "Enter a valid phone number");
