import { db } from "@/lib/db";
import {
  ANALYTICS_CHANNELS,
  type AnalyticsChannel,
  type AnalyticsEventType,
  countEvents,
  listEvents,
} from "@/lib/analytics/events";
import type { Role } from "@/lib/roles";

/**
 * KPI aggregation over recorded `AnalyticsEvent` rows. Every function returns
 * numbers derived from the raw events so the definitions stay stable — see
 * docs/analytics-kpis.md for the catalog. Denominators use null (not zero) so
 * "no data" is distinguishable from "0%".
 */

export interface KpiWindow {
  since?: Date;
  until?: Date;
}

export interface KpiSummary {
  totalRegistrations: number;
  totalListings: number;
  totalListingViews: number;
  totalInterests: number;
  totalReservations: number;
  totalCompletions: number;
  totalFailures: number;
  completionRate: number | null;
  pickupFailureRate: number | null;
  noShowRate: number | null;
  /** Median seconds from reservation to a terminal outcome. */
  medianResponseSeconds: number | null;
  complaintsCount: number;
  /** Users with 2+ COMPLETED connections (household + bulk combined). */
  repeatCompleters: number;
}

const RESERVATION_TYPES: AnalyticsEventType[] = [
  "CONNECTION_RESERVED",
  "BULK_RESPONSE_SELECTED",
];
const COMPLETION_TYPES: AnalyticsEventType[] = [
  "CONNECTION_COMPLETED",
  "BULK_RESPONSE_COMPLETED",
];
const FAILURE_TYPES: AnalyticsEventType[] = [
  "CONNECTION_FAILED",
  "BULK_RESPONSE_FAILED",
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

const NO_SHOW_RE = /no.?show/i;

export async function getKpiSummary(window: KpiWindow = {}): Promise<KpiSummary> {
  const [
    totalRegistrations,
    totalListings,
    totalListingViews,
    totalInterests,
    totalReservations,
    completedEvents,
    failedEvents,
    complaintsCount,
  ] = await Promise.all([
    countEvents({ ...window, type: "USER_REGISTERED" }),
    countEvents({ ...window, type: "LISTING_CREATED" }),
    countEvents({ ...window, type: "LISTING_VIEWED" }),
    countEvents({ ...window, type: "INTEREST_EXPRESSED" }),
    countEvents({ ...window, type: RESERVATION_TYPES }),
    listEvents({ ...window, type: COMPLETION_TYPES }),
    listEvents({ ...window, type: FAILURE_TYPES }),
    db.report.count({
      where: {
        ...(window.since || window.until
          ? {
              createdAt: {
                ...(window.since ? { gte: window.since } : {}),
                ...(window.until ? { lte: window.until } : {}),
              },
            }
          : {}),
      },
    }),
  ]);

  const totalCompletions = completedEvents.length;
  const totalFailures = failedEvents.length;
  const total = totalCompletions + totalFailures;

  const responseSeconds = [...completedEvents, ...failedEvents]
    .map((e) => {
      const raw = e.metadata?.responseSeconds;
      return typeof raw === "number" && Number.isFinite(raw) && raw >= 0
        ? raw
        : null;
    })
    .filter((v): v is number => v !== null);

  const noShows = failedEvents.filter((e) => {
    const reason = e.metadata?.failureReason;
    return typeof reason === "string" && NO_SHOW_RE.test(reason);
  }).length;

  // Repeat completers: distinct actorId with 2+ COMPLETED events. The actor
  // on a COMPLETED event is whoever finalised the pickup; either party may
  // finalise, so this is the "people who saw more than one deal through".
  const completerCounts = new Map<string, number>();
  for (const e of completedEvents) {
    if (!e.actorId) continue;
    completerCounts.set(e.actorId, (completerCounts.get(e.actorId) ?? 0) + 1);
  }
  const repeatCompleters = Array.from(completerCounts.values()).filter(
    (n) => n >= 2,
  ).length;

  return {
    totalRegistrations,
    totalListings,
    totalListingViews,
    totalInterests,
    totalReservations,
    totalCompletions,
    totalFailures,
    completionRate: rate(totalCompletions, total),
    pickupFailureRate: rate(totalFailures, total),
    noShowRate: rate(noShows, total),
    medianResponseSeconds: median(responseSeconds),
    complaintsCount,
    repeatCompleters,
  };
}

export interface ChannelKpis {
  channel: AnalyticsChannel;
  listings: number;
  interests: number;
  reservations: number;
  completions: number;
  failures: number;
  completionRate: number | null;
}

export async function getKpiChannelBreakdown(
  window: KpiWindow = {},
): Promise<ChannelKpis[]> {
  return Promise.all(
    ANALYTICS_CHANNELS.map(async (channel) => {
      const [listings, interests, reservations, completions, failures] =
        await Promise.all([
          countEvents({ ...window, channel, type: "LISTING_CREATED" }),
          countEvents({ ...window, channel, type: "INTEREST_EXPRESSED" }),
          countEvents({ ...window, channel, type: RESERVATION_TYPES }),
          countEvents({ ...window, channel, type: COMPLETION_TYPES }),
          countEvents({ ...window, channel, type: FAILURE_TYPES }),
        ]);
      return {
        channel,
        listings,
        interests,
        reservations,
        completions,
        failures,
        completionRate: rate(completions, completions + failures),
      };
    }),
  );
}

export interface DensityRow {
  key: string;
  supply: number;
  demand: number;
}

export interface SupplyDemandDensity {
  byLocality: DensityRow[];
  byMaterial: DensityRow[];
  byRole: DensityRow[];
}

/**
 * Compare supply (LISTING_CREATED) with demand (INTEREST_EXPRESSED +
 * BULK_REQUIREMENT_CREATED) across the dimensions operators care about.
 * Buckets are sorted by descending total so the busiest cell surfaces first.
 */
export async function getSupplyDemandDensity(
  window: KpiWindow = {},
): Promise<SupplyDemandDensity> {
  const [supplyEvents, interestEvents, bulkReqEvents] = await Promise.all([
    listEvents({ ...window, type: "LISTING_CREATED" }),
    listEvents({ ...window, type: "INTEREST_EXPRESSED" }),
    listEvents({ ...window, type: "BULK_REQUIREMENT_CREATED" }),
  ]);

  function bucket(
    keyFn: (e: (typeof supplyEvents)[number]) => string | null,
  ): DensityRow[] {
    const supply = new Map<string, number>();
    const demand = new Map<string, number>();
    for (const e of supplyEvents) {
      const key = keyFn(e);
      if (key === null) continue;
      supply.set(key, (supply.get(key) ?? 0) + 1);
    }
    for (const e of [...interestEvents, ...bulkReqEvents]) {
      const key = keyFn(e);
      if (key === null) continue;
      demand.set(key, (demand.get(key) ?? 0) + 1);
    }
    const keys = new Set([...supply.keys(), ...demand.keys()]);
    const rows: DensityRow[] = Array.from(keys).map((key) => ({
      key,
      supply: supply.get(key) ?? 0,
      demand: demand.get(key) ?? 0,
    }));
    return rows.sort((a, b) => b.supply + b.demand - (a.supply + a.demand));
  }

  return {
    byLocality: bucket((e) => e.locality ?? null),
    byMaterial: bucket((e) => e.material ?? null),
    byRole: bucket((e) => e.actorRole ?? null),
  };
}

export interface RepeatUsageBucket {
  role: Role | "UNKNOWN";
  onceCount: number;
  repeatCount: number;
  distinctCompleters: number;
}

/**
 * Split completers by their event's `actorRole` so operators can see whether
 * repeat usage is coming from households, collectors, dealers, businesses or
 * recyclers. `onceCount` is people with exactly one completion; `repeatCount`
 * is people with two or more.
 */
export interface MonetisationKpis {
  activePromotions: number;
  totalPromotionsPurchased: number;
  totalPromotionsCancelled: number;
  totalPromotionsExpired: number;
  activeSubscriptions: number;
  totalSubscriptionsStarted: number;
  totalSubscriptionsCancelled: number;
  activeAdPlacements: number;
  adImpressions: number;
  adClicks: number;
  adClickThroughRate: number | null;
  /** Sum of `priceCents` from all purchased promotions in-window. */
  promotionRevenueCentsDeclared: number;
  /** Sum of `priceCents` from all subscriptions started in-window. */
  subscriptionRevenueCentsDeclared: number;
}

/**
 * Aggregate monetisation exposure, activation and usage. Reads promotion and
 * subscription counts directly from the domain rows (so a lifecycle status
 * change is reflected immediately) and derives ad impression / click totals
 * from AnalyticsEvent so the metric matches the surface that actually
 * rendered the placement.
 */
export async function getMonetisationKpis(
  window: KpiWindow = {},
): Promise<MonetisationKpis> {
  const dbModule = await import("@/lib/db");
  const { db } = dbModule;
  const now = new Date();

  const [
    activePromotions,
    activeSubscriptions,
    activeAdPlacements,
    purchasedEvents,
    cancelledEvents,
    expiredEvents,
    subStartedEvents,
    subCancelledEvents,
    adImpressions,
    adClicks,
  ] = await Promise.all([
    db.promotion.count({
      where: { status: "ACTIVE", endsAt: { gt: now } },
    }),
    db.premiumSubscription.count({
      where: { status: "ACTIVE", endsAt: { gt: now } },
    }),
    db.adPlacement.count({
      where: {
        status: "ACTIVE",
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    }),
    listEvents({ ...window, type: "PROMOTION_PURCHASED" }),
    countEvents({ ...window, type: "PROMOTION_CANCELLED" }),
    countEvents({ ...window, type: "PROMOTION_EXPIRED" }),
    listEvents({ ...window, type: "SUBSCRIPTION_STARTED" }),
    countEvents({ ...window, type: "SUBSCRIPTION_CANCELLED" }),
    countEvents({ ...window, type: "AD_PLACEMENT_IMPRESSION" }),
    countEvents({ ...window, type: "AD_PLACEMENT_CLICK" }),
  ]);

  function sumPriceCents(events: { metadata: Record<string, unknown> | null }[]) {
    let total = 0;
    for (const e of events) {
      const raw = e.metadata?.priceCents;
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        total += raw;
      }
    }
    return total;
  }

  return {
    activePromotions,
    activeSubscriptions,
    activeAdPlacements,
    totalPromotionsPurchased: purchasedEvents.length,
    totalPromotionsCancelled: cancelledEvents,
    totalPromotionsExpired: expiredEvents,
    totalSubscriptionsStarted: subStartedEvents.length,
    totalSubscriptionsCancelled: subCancelledEvents,
    adImpressions,
    adClicks,
    adClickThroughRate: rate(adClicks, adImpressions),
    promotionRevenueCentsDeclared: sumPriceCents(purchasedEvents),
    subscriptionRevenueCentsDeclared: sumPriceCents(subStartedEvents),
  };
}

export async function getRepeatUsage(
  window: KpiWindow = {},
): Promise<RepeatUsageBucket[]> {
  const events = await listEvents({ ...window, type: COMPLETION_TYPES });
  const byRole = new Map<string, Map<string, number>>();
  for (const e of events) {
    if (!e.actorId) continue;
    const roleKey = e.actorRole ?? "UNKNOWN";
    let userCounts = byRole.get(roleKey);
    if (!userCounts) {
      userCounts = new Map();
      byRole.set(roleKey, userCounts);
    }
    userCounts.set(e.actorId, (userCounts.get(e.actorId) ?? 0) + 1);
  }
  const rows: RepeatUsageBucket[] = [];
  for (const [role, userCounts] of byRole.entries()) {
    const values = Array.from(userCounts.values());
    rows.push({
      role: role as Role | "UNKNOWN",
      onceCount: values.filter((n) => n === 1).length,
      repeatCount: values.filter((n) => n >= 2).length,
      distinctCompleters: values.length,
    });
  }
  return rows.sort((a, b) => b.distinctCompleters - a.distinctCompleters);
}
