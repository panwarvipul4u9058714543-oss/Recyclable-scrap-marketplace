import type { KpiSummary } from "@/lib/analytics/kpis";

/**
 * Pilot targets for the marketplace's first success review. Numbers taken
 * from the manual-pilot plan referenced in issue #7 — every value here is
 * an operator-set floor (or, for the rates below, a bound to stay within).
 * Update this file when the pilot's targets change; the admin analytics
 * page compares live KPIs against these numbers.
 */
export interface PilotTargets {
  totalRegistrations: number;
  totalListings: number;
  totalInterests: number;
  totalCompletions: number;
  minCompletionRate: number; // 0..1
  maxPickupFailureRate: number; // 0..1
  maxNoShowRate: number; // 0..1
  minRepeatCompleters: number;
}

export const PILOT_TARGETS: PilotTargets = {
  totalRegistrations: 100,
  totalListings: 60,
  totalInterests: 120,
  totalCompletions: 30,
  minCompletionRate: 0.6,
  maxPickupFailureRate: 0.2,
  maxNoShowRate: 0.1,
  minRepeatCompleters: 10,
};

export type ComparisonDirection = "at_or_above" | "at_or_below";
export type ComparisonStatus = "met" | "missed" | "unknown";

export interface KpiComparison {
  key: keyof PilotTargets;
  label: string;
  actual: number | null;
  target: number;
  direction: ComparisonDirection;
  status: ComparisonStatus;
  /** True when the value is a rate to be rendered as a percentage. */
  isRate: boolean;
}

function statusFor(
  actual: number | null,
  target: number,
  direction: ComparisonDirection,
): ComparisonStatus {
  if (actual === null) return "unknown";
  if (direction === "at_or_above") return actual >= target ? "met" : "missed";
  return actual <= target ? "met" : "missed";
}

/**
 * Compare the live KPI summary against the pilot targets. Returns one row
 * per target with a met / missed / unknown verdict; a null actual (e.g. no
 * outcomes yet, so `completionRate` is null) reads as `unknown` rather than
 * flipping a target red.
 */
export function compareWithPilotTargets(
  summary: KpiSummary,
  targets: PilotTargets = PILOT_TARGETS,
): KpiComparison[] {
  return [
    {
      key: "totalRegistrations",
      label: "Registrations",
      actual: summary.totalRegistrations,
      target: targets.totalRegistrations,
      direction: "at_or_above",
      isRate: false,
      status: statusFor(
        summary.totalRegistrations,
        targets.totalRegistrations,
        "at_or_above",
      ),
    },
    {
      key: "totalListings",
      label: "Listings",
      actual: summary.totalListings,
      target: targets.totalListings,
      direction: "at_or_above",
      isRate: false,
      status: statusFor(
        summary.totalListings,
        targets.totalListings,
        "at_or_above",
      ),
    },
    {
      key: "totalInterests",
      label: "Leads (interests)",
      actual: summary.totalInterests,
      target: targets.totalInterests,
      direction: "at_or_above",
      isRate: false,
      status: statusFor(
        summary.totalInterests,
        targets.totalInterests,
        "at_or_above",
      ),
    },
    {
      key: "totalCompletions",
      label: "Completions",
      actual: summary.totalCompletions,
      target: targets.totalCompletions,
      direction: "at_or_above",
      isRate: false,
      status: statusFor(
        summary.totalCompletions,
        targets.totalCompletions,
        "at_or_above",
      ),
    },
    {
      key: "minCompletionRate",
      label: "Completion rate",
      actual: summary.completionRate,
      target: targets.minCompletionRate,
      direction: "at_or_above",
      isRate: true,
      status: statusFor(
        summary.completionRate,
        targets.minCompletionRate,
        "at_or_above",
      ),
    },
    {
      key: "maxPickupFailureRate",
      label: "Pickup-failure rate",
      actual: summary.pickupFailureRate,
      target: targets.maxPickupFailureRate,
      direction: "at_or_below",
      isRate: true,
      status: statusFor(
        summary.pickupFailureRate,
        targets.maxPickupFailureRate,
        "at_or_below",
      ),
    },
    {
      key: "maxNoShowRate",
      label: "No-show rate",
      actual: summary.noShowRate,
      target: targets.maxNoShowRate,
      direction: "at_or_below",
      isRate: true,
      status: statusFor(
        summary.noShowRate,
        targets.maxNoShowRate,
        "at_or_below",
      ),
    },
    {
      key: "minRepeatCompleters",
      label: "Repeat completers",
      actual: summary.repeatCompleters,
      target: targets.minRepeatCompleters,
      direction: "at_or_above",
      isRate: false,
      status: statusFor(
        summary.repeatCompleters,
        targets.minRepeatCompleters,
        "at_or_above",
      ),
    },
  ];
}
