import { z } from "zod";

/**
 * The roles a marketplace participant can take on. A single account may hold
 * more than one of these at the same time.
 */
export const ROLES = [
  "HOUSEHOLD",
  "COLLECTOR",
  "DEALER",
  "BUSINESS",
  "RECYCLER",
] as const;

export type Role = (typeof ROLES)[number];

/** Human-readable labels for each role, for use in UI. */
export const ROLE_LABELS: Record<Role, string> = {
  HOUSEHOLD: "Household",
  COLLECTOR: "Collector (Kabadiwala)",
  DEALER: "Scrap Dealer",
  BUSINESS: "Business",
  RECYCLER: "Recycler",
};

/** Roles that are allowed to create scrap listings (used from Step 3 on). */
export const SELLER_ROLES: readonly Role[] = ["HOUSEHOLD", "BUSINESS"];

/**
 * Roles that browse nearby listings — kabadiwalas, dealers and recyclers
 * (used from Step 4 on).
 */
export const COLLECTOR_ROLES: readonly Role[] = [
  "COLLECTOR",
  "DEALER",
  "RECYCLER",
];

/**
 * Roles that can publish a bulk buy requirement (larger / recurring supply
 * needs). Dealers, businesses and recyclers all deal in bulk quantities and
 * are the buy side of the bulk marketplace.
 */
export const BULK_BUYER_ROLES: readonly Role[] = [
  "DEALER",
  "BUSINESS",
  "RECYCLER",
];

/**
 * Roles that can respond to a bulk buy requirement. Small collectors
 * (kabadiwalas) and dealers aggregate supply on the ground, so they are the
 * supply side of the bulk flow.
 */
export const BULK_SUPPLIER_ROLES: readonly Role[] = ["COLLECTOR", "DEALER"];

export const roleSchema = z.enum(ROLES);

/**
 * A non-empty, de-duplicated set of valid roles. Used when a user selects the
 * roles for their account.
 */
export const roleSelectionSchema = z
  .array(roleSchema)
  .min(1, "Select at least one role")
  .transform((roles) => Array.from(new Set(roles)));

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
