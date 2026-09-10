import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Admin"
        title="Marketplace analytics"
        description={
          <span className="flex items-start gap-2">
            <LineChart className="mt-1 h-4 w-4 shrink-0 text-rust" />
            <span>
              Aggregated from analytics events emitted on every state-changing
              seam. Percentages read as &ldquo;—&rdquo; until at least one
              outcome (completed or failed) is recorded. KPI definitions live
              in <code className="font-mono">docs/analytics-kpis.md</code>.
            </span>
          </span>
        }
      />

      <section aria-label="Headline KPIs" className="mb-10 space-y-4">
        <h2 className="font-serif text-2xl tracking-tight">Headline KPIs</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <KpiTile
            label="Repeat completers"
            value={summary.repeatCompleters}
          />
        </div>
      </section>

      <section aria-label="Pilot comparison" className="mb-10 space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">
          Pilot-target comparison
        </h2>
        <p className="text-sm text-ash">
          Live KPIs against the pilot targets defined in{" "}
          <code className="font-mono">
            src/lib/analytics/pilot-targets.ts
          </code>
          . Update that file when the pilot targets change. Rows read as{" "}
          <strong className="font-medium text-ink">unknown</strong> until
          enough data is recorded to compute the value.
        </p>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dune/70 bg-sand/40">
                <Th>Metric</Th>
                <Th>Actual</Th>
                <Th>Target</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {pilotComparison.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-dune/50 last:border-0"
                >
                  <Td>{row.label}</Td>
                  <Td>{formatComparisonValue(row.actual, row.isRate)}</Td>
                  <Td>
                    {row.direction === "at_or_above" ? "≥ " : "≤ "}
                    {formatComparisonValue(row.target, row.isRate)}
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-ash">
          Pilot targets:{" "}
          <span className="font-mono">
            {Object.entries(PILOT_TARGETS)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}
          </span>
        </p>
      </section>

      <section aria-label="Channel breakdown" className="mb-10 space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">
          Channel breakdown
        </h2>
        <p className="text-sm text-ash">
          Route mode and the bulk marketplace measured separately from
          household discovery, per issue #7 acceptance criteria.
        </p>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dune/70 bg-sand/40">
                <Th>Channel</Th>
                <Th>Listings</Th>
                <Th>Interests</Th>
                <Th>Reservations</Th>
                <Th>Completions</Th>
                <Th>Failures</Th>
                <Th>Completion rate</Th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr
                  key={c.channel}
                  className="border-b border-dune/50 last:border-0"
                >
                  <Td>{c.channel}</Td>
                  <Td>{c.listings}</Td>
                  <Td>{c.interests}</Td>
                  <Td>{c.reservations}</Td>
                  <Td>{c.completions}</Td>
                  <Td>{c.failures}</Td>
                  <Td>{formatRate(c.completionRate)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-label="Supply and demand" className="mb-10 space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">
          Supply and demand density
        </h2>
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

      <section aria-label="Monetisation" className="mb-10 space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">Monetisation</h2>
        <p className="text-sm text-ash">
          Exposure, activation and usage of paid features (issue #8). Global
          switch is{" "}
          <Badge tone={monetisationOn ? "moss" : "neutral"}>
            {monetisationOn ? "ENABLED" : "DISABLED"}
          </Badge>{" "}
          — set the{" "}
          <code className="font-mono">MONETISATION_ENABLED</code> env var to{" "}
          <code className="font-mono">1</code> to turn it on. Manage placements
          at{" "}
          <Link
            href="/admin/monetisation"
            className="text-rust underline-offset-4 hover:underline"
          >
            /admin/monetisation
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <KpiTile label="Ad impressions" value={monetisation.adImpressions} />
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

      <section aria-label="Repeat usage" className="space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">Repeat usage</h2>
        {repeat.length === 0 ? (
          <Card className="border-dashed p-5 text-sm text-ash">
            No completed pickups yet. Repeat usage becomes visible once
            participants finish more than one transaction.
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dune/70 bg-sand/40">
                  <Th>Role</Th>
                  <Th>Distinct completers</Th>
                  <Th>Once</Th>
                  <Th>2+ (repeat)</Th>
                </tr>
              </thead>
              <tbody>
                {repeat.map((r) => (
                  <tr
                    key={r.role}
                    className="border-b border-dune/50 last:border-0"
                  >
                    <Td>{r.role}</Td>
                    <Td>{r.distinctCompleters}</Td>
                    <Td>{r.onceCount}</Td>
                    <Td>{r.repeatCount}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.14em] text-ash">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-ink">{children}</td>;
}

function KpiTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-ash">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl leading-none text-ink">
        {value}
      </div>
    </Card>
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
      <div>
        <h3 className="mt-4 font-serif text-lg tracking-tight">{title}</h3>
        <p className="text-sm text-ash">No data yet.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="mt-4 font-serif text-lg tracking-tight">{title}</h3>
      <Card className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dune/70 bg-sand/40">
              <Th>{keyLabel}</Th>
              <Th>Supply (listings)</Th>
              <Th>Demand (interests + bulk reqs)</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className="border-b border-dune/50 last:border-0"
              >
                <Td>{r.key}</Td>
                <Td>{r.supply}</Td>
                <Td>{r.demand}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
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
  const label =
    status === "met" ? "Met" : status === "missed" ? "Missed" : "Unknown";
  const tone: "moss" | "warn" | "neutral" =
    status === "met" ? "moss" : status === "missed" ? "warn" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function formatCents(cents: number): string {
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
