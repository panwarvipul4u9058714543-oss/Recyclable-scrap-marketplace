import type { Promotion } from "@prisma/client";
import { z } from "zod";
import { recordEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { getUserWithRoles } from "@/lib/auth/users";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import { MonetisationError } from "@/lib/monetisation/errors";
import {
  PROMOTION_TIER_SPECS,
  PROMOTION_TIERS,
  isProfessionalRole,
  type PromotionTier,
} from "@/lib/monetisation/plans";

export const purchasePromotionSchema = z.object({
  listingId: z.string().min(1),
  tier: z.enum(PROMOTION_TIERS),
});
export type PurchasePromotionInput = z.infer<typeof purchasePromotionSchema>;

export interface PromotionDTO {
  id: string;
  listingId: string;
  promoterId: string;
  tier: PromotionTier;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  activatedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

function toDTO(row: Promotion): PromotionDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    promoterId: row.promoterId,
    tier: row.tier as PromotionTier,
    status: row.status as PromotionDTO["status"],
    priceCents: row.priceCents,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    activatedAt: row.activatedAt,
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

/**
 * Purchase a promotion for one of the caller's own listings. Refuses when
 * monetisation is disabled, when the caller isn't a professional role, or
 * when the listing belongs to someone else. Activates the promotion
 * immediately (startsAt = now) so it starts boosting the listing straight
 * away; the direct-negotiation / direct-payment flow is unchanged.
 */
export async function purchasePromotion(
  userId: string,
  input: PurchasePromotionInput,
): Promise<PromotionDTO> {
  if (!isMonetisationEnabled()) throw new MonetisationError("disabled");
  const parsed = purchasePromotionSchema.parse(input);
  await ensureProfessional(userId);

  const listing = await db.listing.findUnique({
    where: { id: parsed.listingId },
    select: { id: true, sellerId: true, materialCategory: true, locality: true },
  });
  if (!listing) throw new MonetisationError("not_found");
  if (listing.sellerId !== userId) throw new MonetisationError("forbidden");

  const spec = PROMOTION_TIER_SPECS[parsed.tier];
  const now = new Date();
  const endsAt = new Date(
    now.getTime() + spec.durationDays * 24 * 60 * 60 * 1000,
  );

  const row = await db.promotion.create({
    data: {
      listingId: listing.id,
      promoterId: userId,
      tier: spec.tier,
      status: "ACTIVE",
      priceCents: spec.priceCents,
      startsAt: now,
      endsAt,
      activatedAt: now,
    },
  });

  await Promise.all([
    recordEvent({
      type: "PROMOTION_PURCHASED",
      channel: "GENERAL",
      actorId: userId,
      subjectType: "PROMOTION",
      subjectId: row.id,
      material: listing.materialCategory,
      locality: listing.locality,
      metadata: {
        tier: spec.tier,
        priceCents: spec.priceCents,
        listingId: listing.id,
      },
    }),
    recordEvent({
      type: "PROMOTION_ACTIVATED",
      channel: "GENERAL",
      actorId: userId,
      subjectType: "PROMOTION",
      subjectId: row.id,
      material: listing.materialCategory,
      locality: listing.locality,
      metadata: { tier: spec.tier, listingId: listing.id },
    }),
  ]);

  return toDTO(row);
}

/** Cancel one of the caller's own promotions. */
export async function cancelPromotion(
  userId: string,
  promotionId: string,
): Promise<PromotionDTO> {
  const row = await db.promotion.findUnique({ where: { id: promotionId } });
  if (!row) throw new MonetisationError("not_found");
  if (row.promoterId !== userId) throw new MonetisationError("forbidden");
  if (row.status === "CANCELLED" || row.status === "EXPIRED") {
    throw new MonetisationError("invalid_transition");
  }
  const now = new Date();
  const updated = await db.promotion.update({
    where: { id: promotionId },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordEvent({
    type: "PROMOTION_CANCELLED",
    channel: "GENERAL",
    actorId: userId,
    subjectType: "PROMOTION",
    subjectId: promotionId,
    metadata: { tier: row.tier, listingId: row.listingId },
  });
  return toDTO(updated);
}

/**
 * Sweep any ACTIVE promotions whose endsAt has passed and mark them EXPIRED,
 * recording one PROMOTION_EXPIRED per row. Returns the count. Called on a
 * schedule (or lazily by the discovery service) so the boost naturally lapses
 * without needing an in-band trigger.
 */
export async function expirePromotions(now: Date = new Date()): Promise<number> {
  const rows = await db.promotion.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    select: { id: true, tier: true, listingId: true, promoterId: true },
  });
  if (rows.length === 0) return 0;
  await db.promotion.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "EXPIRED" },
  });
  await Promise.all(
    rows.map((r) =>
      recordEvent({
        type: "PROMOTION_EXPIRED",
        channel: "GENERAL",
        actorId: r.promoterId,
        subjectType: "PROMOTION",
        subjectId: r.id,
        metadata: { tier: r.tier, listingId: r.listingId },
      }),
    ),
  );
  return rows.length;
}

/** True if the given listing has any ACTIVE, unexpired promotion. */
export async function isListingPromoted(listingId: string): Promise<boolean> {
  const row = await db.promotion.findFirst({
    where: {
      listingId,
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Fetch the highest-tier active promotion (PREMIUM before STANDARD) for each
 * of the given listing ids, returned as a Map. Used by discovery to boost
 * and label promoted listings in one query.
 */
export async function listActivePromotionsForListingIds(
  listingIds: string[],
): Promise<Map<string, PromotionDTO>> {
  if (listingIds.length === 0) return new Map();
  const rows = await db.promotion.findMany({
    where: {
      listingId: { in: listingIds },
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
  });
  const rank: Record<PromotionTier, number> = { PREMIUM: 2, STANDARD: 1 };
  const best = new Map<string, PromotionDTO>();
  for (const r of rows) {
    const existing = best.get(r.listingId);
    if (
      !existing ||
      rank[r.tier as PromotionTier] > rank[existing.tier]
    ) {
      best.set(r.listingId, toDTO(r));
    }
  }
  return best;
}

/** List one user's own promotions, most recent first. */
export async function listPromotionsForUser(
  userId: string,
): Promise<PromotionDTO[]> {
  const rows = await db.promotion.findMany({
    where: { promoterId: userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}
