import type { Report } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUserSuspended } from "@/lib/moderation/moderation";

export const REPORT_TARGET_TYPES = ["USER", "LISTING"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type ReportErrorCode =
  | "not_found"
  | "own_target"
  | "invalid_status"
  | "suspended";

export class ReportError extends Error {
  constructor(public readonly code: ReportErrorCode) {
    super(code);
    this.name = "ReportError";
  }
}

export interface ReportDTO {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// A short human-readable reason; the details field carries the free-form
// explanation and is capped separately.
export const reportInputSchema = z.object({
  reason: z.string().trim().min(2).max(60),
  details: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(2000).optional(),
    )
    .optional(),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

function toDTO(row: Report): ReportDTO {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType as ReportTargetType,
    targetId: row.targetId,
    reason: row.reason,
    details: row.details,
    status: row.status as ReportStatus,
    reviewNote: row.reviewNote,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertUserExists(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ReportError("not_found");
}

export async function reportListing(
  reporterId: string,
  listingId: string,
  input: unknown,
): Promise<ReportDTO> {
  if (await isUserSuspended(reporterId)) throw new ReportError("suspended");
  const data = reportInputSchema.parse(input);
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ReportError("not_found");
  if (listing.sellerId === reporterId) throw new ReportError("own_target");

  const row = await db.report.create({
    data: {
      reporterId,
      targetType: "LISTING",
      targetId: listingId,
      reason: data.reason,
      details: data.details ?? null,
    },
  });
  return toDTO(row);
}

export async function reportUser(
  reporterId: string,
  targetUserId: string,
  input: unknown,
): Promise<ReportDTO> {
  if (await isUserSuspended(reporterId)) throw new ReportError("suspended");
  const data = reportInputSchema.parse(input);
  if (reporterId === targetUserId) throw new ReportError("own_target");
  await assertUserExists(targetUserId);

  const row = await db.report.create({
    data: {
      reporterId,
      targetType: "USER",
      targetId: targetUserId,
      reason: data.reason,
      details: data.details ?? null,
    },
  });
  return toDTO(row);
}

// Operator surface: list every report that still needs a decision, newest
// first. Step 4 (operator moderation) will build on this and add resolve /
// dismiss verbs.
export async function listOpenReports(): Promise<ReportDTO[]> {
  const rows = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}
