import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getKpiChannelBreakdown,
  getKpiSummary,
  getMonetisationKpis,
  getRepeatUsage,
  getSupplyDemandDensity,
  type KpiSummary,
} from "@/lib/analytics/kpis";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import {
  PILOT_TARGETS,
  compareWithPilotTargets,
  type ComparisonStatus,
  type KpiComparison,
} from "@/lib/analytics/pilot-targets";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/**
 * Operator analytics. Admin-gated; a non-admin gets a 404 so the surface is
 * never confirmed. Everything on this page is derived from AnalyticsEvent
 * rows the services record on their own write paths — see
 * docs/analytics-kpis.md for the KPI catalog and definitions.
 */
export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.isAdmin) notFound();

  const [summary, channels, density, repeat, monetisation] = await Promise.all([
    getKpiSummary(),
    getKpiChannelBreakdown(),
    getSupplyDemandDensity(),
    getRepeatUsage(),
    getMonetisationKpis(),
  ]);
  const pilotComparison = compareWithPilotTargets(summary);
  const monetisationOn = isMonetisationEnabled();

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Marketplace analytics</h1>
      <p style={{ color: "#9e9e9e" }}>
        Aggregated from analytics events emitted on every state-changing seam.
        Percentages read as “—” until at least one outcome (completed or
        failed) is recorded. KPI definitions live in{" "}
        <code>docs/analytics-kpis.md</code>.
      </p>

      <section aria-label="Headline KPIs" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Headline KPIs</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <KpiTile label="Registrations" value={summary.totalRegistrations} />
          <KpiTile label="Listings" value={summary.totalListings} />
          <KpiTile label="Listing views" value={summary.totalListingViews} />
          <KpiTile label="Leads (interests)" value={summary.totalInterests} />
          <KpiTile label="Reservations" value={summary.totalReservations} />
          <KpiTile label="Completions" value={summary.totalCompletions} />
          <KpiTile label="Failures" value={summary.totalFailures} />
          <KpiTile
            label="Completion rate"
            value={formatRate(summary.completionRate)}
          />
          <KpiTile
            label="Pickup-failure rate"
            value={formatRate(summary.pickupFailureRate)}
          />
          <KpiTile
            label="No-show rate"
            value={formatRate(summary.noShowRate)}
          />
          <KpiTile
            label="Median response"
            value={formatSeconds(summary.medianResponseSeconds)}
          />
          <KpiTile label="Complaints" value={summary.complaintsCount} />
          <KpiTile label="Repeat completers" value={summary.repeatCompleters} />
        </div>
      </section>

      <section
        aria-label="Pilot comparison"
        style={{ marginTop: "1.5rem" }}
      >
        <h2 style={{ fontSize: "1.1rem" }}>Pilot-target comparison</h2>
        <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
          Live KPIs against the pilot targets defined in{" "}
          <code>src/lib/analytics/pilot-targets.ts</code>. Update that file
          when the pilot targets change. Rows read as{" "}
          <strong>unknown</strong> until enough data is recorded to compute
          the value (e.g. no outcomes yet → rates are unknown).
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Metric</th>
                <th style={thStyle}>Actual</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pilotComparison.map((row) => (
                <tr key={row.key}>
                  <td style={tdStyle}>{row.label}</td>
                  <td style={tdStyle}>{formatComparisonValue(row.actual, row.isRate)}</td>
                  <td style={tdStyle}>
                    {row.direction === "at_or_above" ? "≥ " : "≤ "}
                    {formatComparisonValue(row.target, row.isRate)}
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#9e9e9e", fontSize: "0.8rem", marginTop: "0.5rem" }}>
          Pilot targets:{" "}
          {Object.entries(PILOT_TARGETS)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}
        </p>
      </section>

      <section aria-label="Channel breakdown" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Channel breakdown</h2>
        <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
          Route mode and the bulk marketplace measured separately from
          household discovery, per issue #7 acceptance criteria.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Channel</th>
                <th style={thStyle}>Listings</th>
                <th style={thStyle}>Interests</th>
                <th style={thStyle}>Reservations</th>
                <th style={thStyle}>Completions</th>
                <th style={thStyle}>Failures</th>
                <th style={thStyle}>Completion rate</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel}>
                  <td style={tdStyle}>{c.channel}</td>
                  <td style={tdStyle}>{c.listings}</td>
                  <td style={tdStyle}>{c.interests}</td>
                  <td style={tdStyle}>{c.reservations}</td>
                  <td style={tdStyle}>{c.completions}</td>
                  <td style={tdStyle}>{c.failures}</td>
                  <td style={tdStyle}>{formatRate(c.completionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Supply and demand" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Supply and demand density</h2>
        <DensityTable
          title="By locality"
          keyLabel="Locality"
          rows={density.byLocality}
        />
        <DensityTable
          title="By material"
          keyLabel="Material"
          rows={density.byMaterial}
        />
        <DensityTable
          title="By participant role"
          keyLabel="Role"
          rows={density.byRole}
        />
      </section>

      <section aria-label="Monetisation" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Monetisation</h2>
        <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
          Exposure, activation and usage of paid features (issue #8). Global
          switch is{" "}
          <strong>{monetisationOn ? "ENABLED" : "DISABLED"}</strong> — set the{" "}
          <code>MONETISATION_ENABLED</code> env var to <code>1</code> to turn
          it on. Manage placements at{" "}
          <Link href="/admin/monetisation">/admin/monetisation</Link>.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <KpiTile
            label="Active promotions"
            value={monetisation.activePromotions}
          />
          <KpiTile
            label="Promotions purchased"
            value={monetisation.totalPromotionsPurchased}
          />
          <KpiTile
            label="Promotions cancelled"
            value={monetisation.totalPromotionsCancelled}
          />
          <KpiTile
            label="Promotions expired"
            value={monetisation.totalPromotionsExpired}
          />
          <KpiTile
            label="Active subscriptions"
            value={monetisation.activeSubscriptions}
          />
          <KpiTile
            label="Subs started"
            value={monetisation.totalSubscriptionsStarted}
          />
          <KpiTile
            label="Subs cancelled"
            value={monetisation.totalSubscriptionsCancelled}
          />
          <KpiTile
            label="Active ad placements"
            value={monetisation.activeAdPlacements}
          />
          <KpiTile
            label="Ad impressions"
            value={monetisation.adImpressions}
          />
          <KpiTile label="Ad clicks" value={monetisation.adClicks} />
          <KpiTile
            label="Ad click-through rate"
            value={formatRate(monetisation.adClickThroughRate)}
          />
          <KpiTile
            label="Promotion revenue (declared)"
            value={formatCents(monetisation.promotionRevenueCentsDeclared)}
          />
          <KpiTile
            label="Subscription revenue (declared)"
            value={formatCents(monetisation.subscriptionRevenueCentsDeclared)}
          />
        </div>
      </section>

      <section aria-label="Repeat usage" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Repeat usage</h2>
        {repeat.length === 0 ? (
          <p style={{ color: "#9e9e9e" }}>
            No completed pickups yet. Repeat usage becomes visible once
            participants finish more than one transaction.
          </p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Distinct completers</th>
                <th style={thStyle}>Once</th>
                <th style={thStyle}>2+ (repeat)</th>
              </tr>
            </thead>
            <tbody>
              {repeat.map((r) => (
                <tr key={r.role}>
                  <td style={tdStyle}>{r.role}</td>
                  <td style={tdStyle}>{r.distinctCompleters}</td>
                  <td style={tdStyle}>{r.onceCount}</td>
                  <td style={tdStyle}>{r.repeatCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function KpiTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div style={tileStyle}>
      <div style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "0.2rem" }}>
        {value}
      </div>
    </div>
  );
}

function DensityTable({
  title,
  keyLabel,
  rows,
}: {
  title: string;
  keyLabel: string;
  rows: { key: string; supply: number; demand: number }[];
}) {
  if (rows.length === 0) {
    return (
      <>
        <h3 style={{ fontSize: "0.95rem", marginTop: "1rem" }}>{title}</h3>
        <p style={{ color: "#9e9e9e" }}>No data yet.</p>
      </>
    );
  }
  return (
    <>
      <h3 style={{ fontSize: "0.95rem", marginTop: "1rem" }}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>{keyLabel}</th>
              <th style={thStyle}>Supply (listings)</th>
              <th style={thStyle}>Demand (interests + bulk reqs)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={tdStyle}>{r.key}</td>
                <td style={tdStyle}>{r.supply}</td>
                <td style={tdStyle}>{r.demand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatRate(rate: KpiSummary["completionRate"]): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatComparisonValue(
  value: KpiComparison["actual"] | KpiComparison["target"],
  isRate: boolean,
): string {
  if (value === null) return "—";
  if (isRate) return `${(value * 100).toFixed(1)}%`;
  return `${value}`;
}

function StatusBadge({ status }: { status: ComparisonStatus }) {
  const bg =
    status === "met" ? "#2e7d32" : status === "missed" ? "#c62828" : "#616161";
  const label = status === "met" ? "Met" : status === "missed" ? "Missed" : "Unknown";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.55rem",
        borderRadius: 999,
        background: bg,
        color: "#fff",
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function formatCents(cents: number): string {
  // Declared price only — no real currency is charged. Rendered as INR paise
  // → rupees to match the pilot's units, without a locale library.
  const rupees = cents / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

const tileStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.75rem 0.9rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
  marginTop: "0.5rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #333",
  padding: "0.4rem 0.5rem",
  color: "#9e9e9e",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  borderBottom: "1px solid #222",
};
