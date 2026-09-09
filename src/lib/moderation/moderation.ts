import type { Report, User } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { type ReportDTO } from "@/lib/reports/reports";

export type ModerationErrorCode =
  | "forbidden"
  | "not_found"
  | "already_decided"
  | "own_target"
  | "not_suspended"
  | "already_suspended";

export class ModerationError extends Error {
  constructor(public readonly code: ModerationErrorCode) {
    super(code);
    this.name = "ModerationError";
  }
}

export interface SuspendedUserSummary {
  id: string;
  phone: string;
  suspendedAt: Date | null;
  suspensionReason: string | null;
}

export interface ReviewInput {
  note?: string;
}

export interface SuspendInput {
  reason: string;
}

export const reviewInputSchema = z.object({
  note: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(1000).optional(),
    )
    .optional(),
});

export const suspendInputSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});

function reportToDTO(row: Report): ReportDTO {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType as ReportDTO["targetType"],
    targetId: row.targetId,
    reason: row.reason,
    details: row.details,
    status: row.status as ReportDTO["status"],
    reviewNote: row.reviewNote,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function userToSuspendedSummary(row: User): SuspendedUserSummary {
  return {
    id: row.id,
    phone: row.phone,
    suspendedAt: row.suspendedAt,
    suspensionReason: row.suspensionReason,
  };
}

/**
 * Load a user and confirm they hold the admin flag. Throws forbidden for a
 * non-admin caller and not_found when the id is unknown; callers use this to
 * gate every operator surface.
 */
export async function assertAdmin(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ModerationError("not_found");
  if (!user.isAdmin) throw new ModerationError("forbidden");
}

export async function isUserSuspended(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { suspendedAt: true },
  });
  return user !== null && user.suspendedAt !== null;
}

/**
 * Small helper for write-path guards: return true when the caller is
 * suspended so the service can throw its own "suspended" domain error and
 * keep its error surface intact. Read paths never call this — a suspended
 * account can still browse the marketplace.
 */
export async function callerIsSuspended(userId: string): Promise<boolean> {
  return isUserSuspended(userId);
}

/** Operator surface: list every report still awaiting a decision. */
export async function listOpenReportsForAdmin(
  adminId: string,
): Promise<ReportDTO[]> {
  await assertAdmin(adminId);
  const rows = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(reportToDTO);
}

/** A report enriched with reporter phone and best-effort target descriptor,
 * for the /moderation queue where operators need enough context to decide. */
export interface EnrichedReport extends ReportDTO {
  reporterPhone: string;
  targetLabel: string;
  targetUserId: string | null;
  targetUserSuspended: boolean;
}

export async function listOpenReportsWithContext(
  adminId: string,
): Promise<EnrichedReport[]> {
  const reports = await listOpenReportsForAdmin(adminId);
  if (reports.length === 0) return [];

  const reporterIds = Array.from(new Set(reports.map((r) => r.reporterId)));
  const userTargetIds = Array.from(
    new Set(
      reports.filter((r) => r.targetType === "USER").map((r) => r.targetId),
    ),
  );
  const listingTargetIds = Array.from(
    new Set(
      reports.filter((r) => r.targetType === "LISTING").map((r) => r.targetId),
    ),
  );

  const [reporters, userTargets, listingTargets] = await Promise.all([
    db.user.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, phone: true },
    }),
    userTargetIds.length
      ? db.user.findMany({
          where: { id: { in: userTargetIds } },
          select: { id: true, phone: true, suspendedAt: true },
        })
      : Promise.resolve([]),
    listingTargetIds.length
      ? db.listing.findMany({
          where: { id: { in: listingTargetIds } },
          select: { id: true, title: true, sellerId: true },
        })
      : Promise.resolve([]),
  ]);

  const listingSellerIds = Array.from(
    new Set(listingTargets.map((l) => l.sellerId)),
  );
  const listingSellers = listingSellerIds.length
    ? await db.user.findMany({
        where: { id: { in: listingSellerIds } },
        select: { id: true, suspendedAt: true },
      })
    : [];

  const reporterMap = new Map(reporters.map((u) => [u.id, u.phone]));
  const userTargetMap = new Map(userTargets.map((u) => [u.id, u]));
  const listingMap = new Map(listingTargets.map((l) => [l.id, l]));
  const sellerMap = new Map(listingSellers.map((u) => [u.id, u.suspendedAt]));

  return reports.map((r) => {
    let targetLabel: string;
    let targetUserId: string | null;
    let targetUserSuspended = false;

    if (r.targetType === "USER") {
      const target = userTargetMap.get(r.targetId);
      targetLabel = target ? `user ${target.phone}` : "user (deleted)";
      targetUserId = target?.id ?? null;
      targetUserSuspended = target !== undefined && target.suspendedAt !== null;
    } else {
      const listing = listingMap.get(r.targetId);
      targetLabel = listing
        ? `listing "${listing.title}"`
        : "listing (deleted)";
      targetUserId = listing?.sellerId ?? null;
      const sellerSuspendedAt =
        listing !== undefined ? sellerMap.get(listing.sellerId) : null;
      targetUserSuspended =
        sellerSuspendedAt !== undefined && sellerSuspendedAt !== null;
    }

    return {
      ...r,
      reporterPhone: reporterMap.get(r.reporterId) ?? "(unknown)",
      targetLabel,
      targetUserId,
      targetUserSuspended,
    };
  });
}

async function decideReport(
  adminId: string,
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
  input: ReviewInput,
): Promise<ReportDTO> {
  await assertAdmin(adminId);
  const data = reviewInputSchema.parse(input);

  const row = await db.report.findUnique({ where: { id: reportId } });
  if (!row) throw new ModerationError("not_found");
  if (row.status !== "OPEN") throw new ModerationError("already_decided");

  const updated = await db.report.update({
    where: { id: reportId },
    data: {
      status,
      reviewedById: adminId,
      reviewedAt: new Date(),
      reviewNote: data.note ?? null,
    },
  });
  return reportToDTO(updated);
}

export async function resolveReport(
  adminId: string,
  reportId: string,
  input: ReviewInput,
): Promise<ReportDTO> {
  return decideReport(adminId, reportId, "RESOLVED", input);
}

export async function dismissReport(
  adminId: string,
  reportId: string,
  input: ReviewInput,
): Promise<ReportDTO> {
  return decideReport(adminId, reportId, "DISMISSED", input);
}

/**
 * Suspend an account so its writes are refused platform-wide. The caller
 * must be an admin, must not be the target, and the target must exist and
 * not already be suspended. `reason` is stored so operators can review the
 * context later.
 */
export async function suspendUser(
  adminId: string,
  targetUserId: string,
  input: SuspendInput,
): Promise<SuspendedUserSummary> {
  await assertAdmin(adminId);
  if (adminId === targetUserId) throw new ModerationError("own_target");
  const data = suspendInputSchema.parse(input);

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new ModerationError("not_found");
  if (target.suspendedAt !== null) {
    throw new ModerationError("already_suspended");
  }

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: {
      suspendedAt: new Date(),
      suspensionReason: data.reason,
    },
  });
  return userToSuspendedSummary(updated);
}

/** Reinstate a previously suspended account. */
export async function reinstateUser(
  adminId: string,
  targetUserId: string,
): Promise<SuspendedUserSummary> {
  await assertAdmin(adminId);

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new ModerationError("not_found");
  if (target.suspendedAt === null) {
    throw new ModerationError("not_suspended");
  }

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { suspendedAt: null, suspensionReason: null },
  });
  return userToSuspendedSummary(updated);
}

/** Operator surface: list every currently suspended account. */
export async function listSuspendedUsers(
  adminId: string,
): Promise<SuspendedUserSummary[]> {
  await assertAdmin(adminId);
  const rows = await db.user.findMany({
    where: { suspendedAt: { not: null } },
    orderBy: { suspendedAt: "desc" },
  });
  return rows.map(userToSuspendedSummary);
}
