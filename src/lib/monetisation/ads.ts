import type { AdPlacement } from "@prisma/client";
import { z } from "zod";
import { recordEvent } from "@/lib/analytics/events";
import { getUserWithRoles } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import { MonetisationError } from "@/lib/monetisation/errors";
import { AD_SURFACES, type AdSurface } from "@/lib/monetisation/plans";

export const createAdPlacementSchema = z.object({
  surface: z.enum(AD_SURFACES),
  headline: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  linkUrl: z.string().url(),
  sponsorName: z.string().max(200).optional(),
  endsAt: z.date().optional(),
});
export type CreateAdPlacementInput = z.infer<typeof createAdPlacementSchema>;

export interface AdPlacementDTO {
  id: string;
  surface: AdSurface;
  headline: string;
  body: string;
  linkUrl: string;
  sponsorName: string | null;
  status: "ACTIVE" | "PAUSED";
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
}

function toDTO(row: AdPlacement): AdPlacementDTO {
  return {
    id: row.id,
    surface: row.surface as AdSurface,
    headline: row.headline,
    body: row.body,
    linkUrl: row.linkUrl,
    sponsorName: row.sponsorName,
    status: row.status as AdPlacementDTO["status"],
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

async function ensureAdmin(userId: string): Promise<void> {
  const user = await getUserWithRoles(userId);
  if (!user || !user.isAdmin) throw new MonetisationError("forbidden");
}

/**
 * Create an ad placement on a surface. Admin-only; refused when monetisation
 * is disabled. Placements never block the core transaction flow — the pages
 * that render them do so as a distinct block alongside the primary list.
 */
export async function createAdPlacement(
  adminId: string,
  input: CreateAdPlacementInput,
): Promise<AdPlacementDTO> {
  if (!isMonetisationEnabled()) throw new MonetisationError("disabled");
  await ensureAdmin(adminId);
  const parsed = createAdPlacementSchema.parse(input);

  const row = await db.adPlacement.create({
    data: {
      surface: parsed.surface,
      headline: parsed.headline,
      body: parsed.body,
      linkUrl: parsed.linkUrl,
      sponsorName: parsed.sponsorName ?? null,
      endsAt: parsed.endsAt ?? null,
    },
  });

  await recordEvent({
    type: "AD_PLACEMENT_CREATED",
    channel: "GENERAL",
    actorId: adminId,
    subjectType: "AD_PLACEMENT",
    subjectId: row.id,
    metadata: {
      surface: parsed.surface,
      sponsorName: parsed.sponsorName ?? null,
    },
  });

  return toDTO(row);
}

/**
 * List ACTIVE, unexpired placements for a surface. Returns an empty array
 * when monetisation is disabled so any caller wired into a page (like the
 * discovery view) can safely fold the result into its render — no throw.
 */
export async function listActiveAdPlacements(
  surface: AdSurface,
): Promise<AdPlacementDTO[]> {
  if (!isMonetisationEnabled()) return [];
  const now = new Date();
  const rows = await db.adPlacement.findMany({
    where: {
      surface,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

/** List every placement — admin surface. */
export async function listAllAdPlacements(): Promise<AdPlacementDTO[]> {
  const rows = await db.adPlacement.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function setAdPlacementStatus(
  adminId: string,
  placementId: string,
  status: "ACTIVE" | "PAUSED",
): Promise<AdPlacementDTO> {
  await ensureAdmin(adminId);
  const row = await db.adPlacement.findUnique({ where: { id: placementId } });
  if (!row) throw new MonetisationError("not_found");
  const updated = await db.adPlacement.update({
    where: { id: placementId },
    data: { status },
  });
  return toDTO(updated);
}

/**
 * Record one impression of a placement. Best-effort — the recordEvent inside
 * already swallows failures — so a page fold-in never fails a page render.
 */
export async function recordAdImpression(
  placementId: string,
  viewerId: string | null,
): Promise<void> {
  await recordEvent({
    type: "AD_PLACEMENT_IMPRESSION",
    channel: "GENERAL",
    actorId: viewerId ?? null,
    subjectType: "AD_PLACEMENT",
    subjectId: placementId,
  });
}

/** Record one click of a placement. */
export async function recordAdClick(
  placementId: string,
  viewerId: string | null,
): Promise<void> {
  await recordEvent({
    type: "AD_PLACEMENT_CLICK",
    channel: "GENERAL",
    actorId: viewerId ?? null,
    subjectType: "AD_PLACEMENT",
    subjectId: placementId,
  });
}
