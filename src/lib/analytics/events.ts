import type { AnalyticsEvent } from "@prisma/client";
import { db } from "@/lib/db";
import type { MaterialCategory } from "@/lib/materials";
import type { Role } from "@/lib/roles";

/**
 * Marketplace analytics events. Services emit one row per state-changing
 * seam so operators can measure completed connections, response times,
 * pickup failures, no-shows, repeat usage and supply/demand density —
 * separately for household discovery, route mode and the bulk marketplace.
 *
 * Recording is best-effort: `recordEvent` never throws — every write path
 * calls it after its own write has committed, so a failing insert only
 * loses the row, never the underlying business action.
 */
export const ANALYTICS_EVENT_TYPES = [
  // The download-equivalent boundary: a new phone-verified user account.
  "USER_REGISTERED",
  // Listing lifecycle and the discovery view a household seller cares about.
  "LISTING_CREATED",
  "LISTING_VIEWED",
  // The buyer-seller connection lifecycle for household listings.
  "INTEREST_EXPRESSED",
  "CONNECTION_RESERVED",
  "CONNECTION_CANCELLED",
  "CONNECTION_COMPLETED",
  "CONNECTION_FAILED",
  "MUTUAL_REVEAL_COMPLETED",
  // Route mode: collector opened a trip, and every listing that fanned out
  // to that route as a notification.
  "ROUTE_STARTED",
  "ROUTE_MATCH_NOTIFIED",
  // Bulk marketplace lifecycle (parallel to the household connection).
  "BULK_REQUIREMENT_CREATED",
  "BULK_RESPONSE_CREATED",
  "BULK_RESPONSE_SELECTED",
  "BULK_RESPONSE_CANCELLED",
  "BULK_RESPONSE_COMPLETED",
  "BULK_RESPONSE_FAILED",
  "BULK_MUTUAL_REVEAL_COMPLETED",
  // Saved-search alerts fanned out to a bulk buyer at listing-create time.
  "SAVED_SEARCH_ALERT_CREATED",
  // Monetisation lifecycle (issue #8). Recorded so operators can measure
  // exposure (impression), activation (a promoted listing being viewed or an
  // ad click) and usage (subscriptions and promotions in flight).
  "PROMOTION_PURCHASED",
  "PROMOTION_ACTIVATED",
  "PROMOTION_CANCELLED",
  "PROMOTION_EXPIRED",
  "PROMOTED_LISTING_VIEWED",
  "SUBSCRIPTION_STARTED",
  "SUBSCRIPTION_CANCELLED",
  "AD_PLACEMENT_CREATED",
  "AD_PLACEMENT_IMPRESSION",
  "AD_PLACEMENT_CLICK",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/**
 * The channel splits the KPI surface into the three lifecycles the platform
 * runs. GENERAL is for cross-cutting events (a new registration) that don't
 * belong to any one marketplace flow.
 */
export const ANALYTICS_CHANNELS = [
  "HOUSEHOLD",
  "ROUTE",
  "BULK",
  "GENERAL",
] as const;
export type AnalyticsChannel = (typeof ANALYTICS_CHANNELS)[number];

/** The primary domain row an event concerns; used for cohort queries. */
export const ANALYTICS_SUBJECT_TYPES = [
  "USER",
  "LISTING",
  "INTEREST",
  "CONNECTION",
  "ROUTE",
  "ROUTE_NOTIFICATION",
  "BULK_REQUIREMENT",
  "BULK_RESPONSE",
  "SAVED_SEARCH",
  "SAVED_SEARCH_ALERT",
  "PROMOTION",
  "SUBSCRIPTION",
  "AD_PLACEMENT",
] as const;
export type AnalyticsSubjectType = (typeof ANALYTICS_SUBJECT_TYPES)[number];

export interface RecordEventInput {
  type: AnalyticsEventType;
  channel?: AnalyticsChannel;
  actorId?: string | null;
  actorRole?: Role | null;
  subjectType?: AnalyticsSubjectType | null;
  subjectId?: string | null;
  material?: MaterialCategory | string | null;
  locality?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Optional override — normally omitted so the row uses the DB default. */
  createdAt?: Date;
}

export interface AnalyticsEventDTO {
  id: string;
  type: AnalyticsEventType;
  channel: AnalyticsChannel;
  actorId: string | null;
  actorRole: Role | null;
  subjectType: AnalyticsSubjectType | null;
  subjectId: string | null;
  material: string | null;
  locality: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

function toDTO(row: AnalyticsEvent): AnalyticsEventDTO {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    type: row.type as AnalyticsEventType,
    channel: row.channel as AnalyticsChannel,
    actorId: row.actorId,
    actorRole: row.actorRole as Role | null,
    subjectType: row.subjectType as AnalyticsSubjectType | null,
    subjectId: row.subjectId,
    material: row.material,
    locality: row.locality,
    metadata,
    createdAt: row.createdAt,
  };
}

/**
 * Persist one event. Never throws — a failing insert quietly drops the row
 * so the surrounding business write is never broken by analytics. Callers
 * should invoke this AFTER their own write has committed, and can safely
 * fire-and-forget the returned promise where they don't need the id.
 */
export async function recordEvent(
  input: RecordEventInput,
): Promise<AnalyticsEventDTO | null> {
  try {
    const row = await db.analyticsEvent.create({
      data: {
        type: input.type,
        channel: input.channel ?? "GENERAL",
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        material: input.material ?? null,
        locality: input.locality ?? null,
        metadata:
          input.metadata && Object.keys(input.metadata).length > 0
            ? JSON.stringify(input.metadata)
            : null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
    return toDTO(row);
  } catch {
    return null;
  }
}

export interface EventQuery {
  type?: AnalyticsEventType | AnalyticsEventType[];
  channel?: AnalyticsChannel | AnalyticsChannel[];
  actorId?: string;
  subjectType?: AnalyticsSubjectType;
  subjectId?: string;
  material?: string;
  locality?: string;
  since?: Date;
  until?: Date;
}

function toWhere(query: EventQuery) {
  const where: Record<string, unknown> = {};
  if (query.type) {
    where.type = Array.isArray(query.type) ? { in: query.type } : query.type;
  }
  if (query.channel) {
    where.channel = Array.isArray(query.channel)
      ? { in: query.channel }
      : query.channel;
  }
  if (query.actorId) where.actorId = query.actorId;
  if (query.subjectType) where.subjectType = query.subjectType;
  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.material) where.material = query.material;
  if (query.locality) where.locality = query.locality;
  if (query.since || query.until) {
    where.createdAt = {
      ...(query.since ? { gte: query.since } : {}),
      ...(query.until ? { lte: query.until } : {}),
    };
  }
  return where;
}

/** Total number of events matching a query — the KPI service's basic building block. */
export async function countEvents(query: EventQuery = {}): Promise<number> {
  return db.analyticsEvent.count({ where: toWhere(query) });
}

/** Read raw events — used by the KPI service for time-derived calculations. */
export async function listEvents(
  query: EventQuery = {},
): Promise<AnalyticsEventDTO[]> {
  const rows = await db.analyticsEvent.findMany({
    where: toWhere(query),
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}
