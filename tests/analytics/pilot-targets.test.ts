import { describe, expect, it } from "vitest";
import type { KpiSummary } from "@/lib/analytics/kpis";
import {
  PILOT_TARGETS,
  compareWithPilotTargets,
} from "@/lib/analytics/pilot-targets";

function summary(overrides: Partial<KpiSummary> = {}): KpiSummary {
  return {
    totalRegistrations: 0,
    totalListings: 0,
    totalListingViews: 0,
    totalInterests: 0,
    totalReservations: 0,
    totalCompletions: 0,
    totalFailures: 0,
    completionRate: null,
    pickupFailureRate: null,
    noShowRate: null,
    medianResponseSeconds: null,
    complaintsCount: 0,
    repeatCompleters: 0,
    ...overrides,
  };
}

describe("compareWithPilotTargets", () => {
  it("marks each row `unknown` when the actual is null (no outcomes yet)", async () => {
    const rows = compareWithPilotTargets(
      summary({
        totalListings: 5,
        completionRate: null,
        noShowRate: null,
      }),
    );
    const completion = rows.find((r) => r.key === "minCompletionRate")!;
    expect(completion.status).toBe("unknown");
    const noShow = rows.find((r) => r.key === "maxNoShowRate")!;
    expect(noShow.status).toBe("unknown");
  });

  it("marks at-or-above rows met when the actual meets or exceeds the target", async () => {
    const rows = compareWithPilotTargets(
      summary({
        totalListings: PILOT_TARGETS.totalListings,
        totalRegistrations: PILOT_TARGETS.totalRegistrations - 1,
        completionRate: PILOT_TARGETS.minCompletionRate + 0.05,
      }),
    );
    expect(rows.find((r) => r.key === "totalListings")!.status).toBe("met");
    expect(rows.find((r) => r.key === "totalRegistrations")!.status).toBe(
      "missed",
    );
    expect(rows.find((r) => r.key === "minCompletionRate")!.status).toBe(
      "met",
    );
  });

  it("marks at-or-below rows met when the actual stays at or under the ceiling", async () => {
    const rows = compareWithPilotTargets(
      summary({
        pickupFailureRate: PILOT_TARGETS.maxPickupFailureRate,
        noShowRate: PILOT_TARGETS.maxNoShowRate + 0.01,
      }),
    );
    expect(rows.find((r) => r.key === "maxPickupFailureRate")!.status).toBe(
      "met",
    );
    expect(rows.find((r) => r.key === "maxNoShowRate")!.status).toBe(
      "missed",
    );
  });
});
