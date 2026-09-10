import type { PremiumSubscription } from "@prisma/client";
import { z } from "zod";
import { recordEvent } from "@/lib/analytics/events";
import { getUserWithRoles } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import { MonetisationError } from "@/lib/monetisation/errors";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_SPECS,
  isProfessionalRole,
  type SubscriptionPlan,
} from "@/lib/monetisation/plans";

export const subscribeSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export interface SubscriptionDTO {
  id: string;
  subscriberId: string;
  plan: SubscriptionPlan;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  createdAt: Date;
}

function toDTO(row: PremiumSubscription): SubscriptionDTO {
  return {
    id: row.id,
    subscriberId: row.subscriberId,
    plan: row.plan as SubscriptionPlan,
    status: row.status as SubscriptionDTO["status"],
    priceCents: row.priceCents,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
  };
}

async function ensureProfessional(userId: string): Promise<void> {
  const user = await getUserWithRoles(userId);
  if (!user || !user.roles.some(isProfessionalRole)) {
    throw new MonetisationError("not_professional");
  }
}

/** Start a subscription for the caller. At most one ACTIVE per user. */
export async function subscribe(
  userId: string,
  input: SubscribeInput,
): Promise<SubscriptionDTO> {
  if (!isMonetisationEnabled()) throw new MonetisationError("disabled");
  const parsed = subscribeSchema.parse(input);
  await ensureProfessional(userId);

  const existing = await getActiveSubscription(userId);
  if (existing) throw new MonetisationError("already_active");

  const spec = SUBSCRIPTION_PLAN_SPECS[parsed.plan];
  const now = new Date();
  const endsAt = new Date(
    now.getTime() + spec.durationDays * 24 * 60 * 60 * 1000,
  );

  const row = await db.premiumSubscription.create({
    data: {
      subscriberId: userId,
      plan: spec.plan,
      status: "ACTIVE",
      priceCents: spec.priceCents,
      startsAt: now,
      endsAt,
    },
  });

  await recordEvent({
    type: "SUBSCRIPTION_STARTED",
    channel: "GENERAL",
    actorId: userId,
    subjectType: "SUBSCRIPTION",
    subjectId: row.id,
    metadata: { plan: spec.plan, priceCents: spec.priceCents },
  });

  return toDTO(row);
}

/** Cancel one of the caller's own subscriptions. */
export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionDTO> {
  const row = await db.premiumSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!row) throw new MonetisationError("not_found");
  if (row.subscriberId !== userId) throw new MonetisationError("forbidden");
  if (row.status !== "ACTIVE") {
    throw new MonetisationError("invalid_transition");
  }
  const now = new Date();
  const updated = await db.premiumSubscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordEvent({
    type: "SUBSCRIPTION_CANCELLED",
    channel: "GENERAL",
    actorId: userId,
    subjectType: "SUBSCRIPTION",
    subjectId: subscriptionId,
    metadata: { plan: row.plan },
  });
  return toDTO(updated);
}

/** The caller's currently-active (unexpired) subscription, if any. */
export async function getActiveSubscription(
  userId: string,
): Promise<SubscriptionDTO | null> {
  const row = await db.premiumSubscription.findFirst({
    where: {
      subscriberId: userId,
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? toDTO(row) : null;
}

/** All of the caller's subscriptions, most recent first. */
export async function listSubscriptionsForUser(
  userId: string,
): Promise<SubscriptionDTO[]> {
  const rows = await db.premiumSubscription.findMany({
    where: { subscriberId: userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}
