import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getKpiChannelBreakdown,
  getKpiSummary,
  getRepeatUsage,
  getSupplyDemandDensity,
  type KpiSummary,
} from "@/lib/analytics/kpis";
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

  const [summary, channels, density, repeat] = await Promise.all([
    getKpiSummary(),
    getKpiChannelBreakdown(),
    getSupplyDemandDensity(),
    getRepeatUsage(),
  ]);

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Marketplace analytics</h1>
      <p style={{ color: "#9e9e9e" }}>
        Aggregated from analytics events emitted on every state-changing seam.
        Percentages read as “—” until at least one outcome (completed or
        failed) is recorded.
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
