import type { Role } from "@/lib/roles";

/**
 * Static catalog of paid monetisation offerings. Each entry documents the
 * concrete visibility or workflow benefit the buyer gets, so the UI can
 * render exactly what issue #8 calls "clearly identify what visibility or
 * workflow benefit they provide". Prices are declared (in cents / paise) and
 * recorded on the row; no real payment is processed in this initial release
 * — the direct-negotiation and direct-payment model is unchanged.
 */

export const PROMOTION_TIERS = ["STANDARD", "PREMIUM"] as const;
export type PromotionTier = (typeof PROMOTION_TIERS)[number];

export interface PromotionTierSpec {
  tier: PromotionTier;
  label: string;
  benefit: string;
  durationDays: number;
  priceCents: number;
}

export const PROMOTION_TIER_SPECS: Record<PromotionTier, PromotionTierSpec> = {
  STANDARD: {
    tier: "STANDARD",
    label: "Standard promotion",
    benefit:
      "Boosts your listing above non-promoted results in nearby-discovery for 7 days and marks it as Promoted.",
    durationDays: 7,
    priceCents: 49900,
  },
  PREMIUM: {
    tier: "PREMIUM",
    label: "Premium promotion",
    benefit:
      "Boosts your listing to the top of nearby-discovery for 14 days, marks it as Featured, and includes a saved-search alert priority tag for bulk buyers.",
    durationDays: 14,
    priceCents: 129900,
  },
};

export const SUBSCRIPTION_PLANS = ["BUSINESS", "PRO"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export interface SubscriptionPlanSpec {
  plan: SubscriptionPlan;
  label: string;
  benefit: string;
  durationDays: number;
  priceCents: number;
}

export const SUBSCRIPTION_PLAN_SPECS: Record<
  SubscriptionPlan,
  SubscriptionPlanSpec
> = {
  BUSINESS: {
    plan: "BUSINESS",
    label: "Business tools (monthly)",
    benefit:
      "Access to your own monthly activity digest, saved-search priority, and a Verified Business badge on your public profile.",
    durationDays: 30,
    priceCents: 99900,
  },
  PRO: {
    plan: "PRO",
    label: "Pro tools (monthly)",
    benefit:
      "Everything in Business, plus a monthly Standard promotion credit and priority visibility on bulk requirements.",
    durationDays: 30,
    priceCents: 199900,
  },
};

/**
 * Roles that can purchase paid monetisation. Households and small collectors
 * (kabadiwalas) always stay on the free tier per issue #8 acceptance
 * criteria — only professional roles pay.
 */
export const PROFESSIONAL_ROLES: readonly Role[] = [
  "DEALER",
  "BUSINESS",
  "RECYCLER",
];

export function isProfessionalRole(role: Role): boolean {
  return PROFESSIONAL_ROLES.includes(role);
}

export const AD_SURFACES = [
  "DISCOVERY",
  "BULK_BROWSE",
  "DASHBOARD",
] as const;
export type AdSurface = (typeof AD_SURFACES)[number];
