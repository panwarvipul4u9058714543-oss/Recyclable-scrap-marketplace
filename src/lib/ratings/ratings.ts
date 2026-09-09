import type { Rating } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUserSuspended } from "@/lib/moderation/moderation";

export type RatingErrorCode =
  | "not_found"
  | "forbidden"
  | "not_terminal"
  | "already_rated"
  | "suspended";

export class RatingError extends Error {
  constructor(public readonly code: RatingErrorCode) {
    super(code);
    this.name = "RatingError";
  }
}

export interface RatingDTO {
  id: string;
  connectionId: string;
  raterId: string;
  rateeId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export interface RatingSummary {
  count: number;
  average: number | null;
}

export const ratingInputSchema = z.object({
  score: z.number().int().gte(1).lte(5),
  comment: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(500).optional(),
    )
    .optional(),
});

export type RatingInput = z.infer<typeof ratingInputSchema>;

// Ratings are only accepted after the pickup actually happened — completed or
// failed. Cancelled/expired are excluded because a party could rack up bad
// ratings by immediately reserving and cancelling.
const RATEABLE_STATUSES = new Set(["COMPLETED", "FAILED"]);

function toDTO(row: Rating): RatingDTO {
  return {
    id: row.id,
    connectionId: row.connectionId,
    raterId: row.raterId,
    rateeId: row.rateeId,
    score: row.score,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

export async function submitRating(
  raterId: string,
  connectionId: string,
  input: unknown,
): Promise<RatingDTO> {
  if (await isUserSuspended(raterId)) throw new RatingError("suspended");
  const data = ratingInputSchema.parse(input);
  const connection = await db.connection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) throw new RatingError("not_found");
  if (
    connection.sellerId !== raterId &&
    connection.collectorId !== raterId
  ) {
    // Never confirm a connection's existence to an outsider.
    throw new RatingError("not_found");
  }
  if (!RATEABLE_STATUSES.has(connection.status)) {
    throw new RatingError("not_terminal");
  }

  const rateeId =
    connection.sellerId === raterId
      ? connection.collectorId
      : connection.sellerId;

  const existing = await db.rating.findUnique({
    where: { connectionId_raterId: { connectionId, raterId } },
  });
  if (existing) throw new RatingError("already_rated");

  const row = await db.rating.create({
    data: {
      connectionId,
      raterId,
      rateeId,
      score: data.score,
      comment: data.comment ?? null,
    },
  });
  return toDTO(row);
}

export async function getRatingSummary(
  userId: string,
): Promise<RatingSummary> {
  const agg = await db.rating.aggregate({
    where: { rateeId: userId },
    _count: { _all: true },
    _avg: { score: true },
  });
  const count = agg._count._all;
  const rawAvg = agg._avg.score;
  const average =
    count === 0 || rawAvg == null
      ? null
      : Math.round(rawAvg * 10) / 10;
  return { count, average };
}

export async function listRatingsFor(userId: string): Promise<RatingDTO[]> {
  const rows = await db.rating.findMany({
    where: { rateeId: userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

/** The rating (if any) the caller has already left on this connection. */
export async function getRatingByRater(
  raterId: string,
  connectionId: string,
): Promise<RatingDTO | null> {
  const row = await db.rating.findUnique({
    where: { connectionId_raterId: { connectionId, raterId } },
  });
  return row ? toDTO(row) : null;
}
