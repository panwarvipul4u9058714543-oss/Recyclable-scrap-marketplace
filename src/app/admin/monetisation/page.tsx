import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listAllAdPlacements } from "@/lib/monetisation/ads";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import {
  PROMOTION_TIER_SPECS,
  SUBSCRIPTION_PLAN_SPECS,
} from "@/lib/monetisation/plans";
import { NewAdPlacementForm } from "./NewAdPlacementForm";
import { AdPlacementRow } from "./AdPlacementRow";

export const dynamic = "force-dynamic";

/**
 * Operator surface for configuring paid inventory (ad placements). Admin-
 * gated; a non-admin gets a 404 so the surface is never confirmed.
 */
export default async function AdminMonetisationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.isAdmin) notFound();

  const monetisationOn = isMonetisationEnabled();
  const placements = await listAllAdPlacements();

  return (
    <main>
      <p>
        <Link href="/admin/analytics">← Back to analytics</Link>
      </p>
      <h1>Monetisation</h1>
      <p style={{ color: "#9e9e9e" }}>
        Manage paid inventory: promoted-listing tiers, business subscriptions
        and advertising placements. Global switch is{" "}
        <strong>{monetisationOn ? "ENABLED" : "DISABLED"}</strong> — set the{" "}
        <code>MONETISATION_ENABLED</code> env var to <code>1</code> to turn it
        on. Basic listing and discovery stay free regardless.
      </p>

      <section aria-label="Promotion tiers" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Promotion tiers</h2>
        <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
          What professional sellers see on the promotion catalog. Update
          prices and durations in{" "}
          <code>src/lib/monetisation/plans.ts</code>.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Benefit</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>Price (declared)</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(PROMOTION_TIER_SPECS).map((spec) => (
              <tr key={spec.tier}>
                <td style={tdStyle}>{spec.label}</td>
                <td style={tdStyle}>{spec.benefit}</td>
                <td style={tdStyle}>{spec.durationDays} days</td>
                <td style={tdStyle}>{formatCents(spec.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Subscription plans" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Subscription plans</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Benefit</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>Price (declared)</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(SUBSCRIPTION_PLAN_SPECS).map((spec) => (
              <tr key={spec.plan}>
                <td style={tdStyle}>{spec.label}</td>
                <td style={tdStyle}>{spec.benefit}</td>
                <td style={tdStyle}>{spec.durationDays} days</td>
                <td style={tdStyle}>{formatCents(spec.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Ad placements" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Ad placements</h2>
        <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
          Placements are rendered as a distinct block on their surface and
          never block the core transaction flow. Pause a placement to hide it
          without deleting it.
        </p>
        {monetisationOn ? (
          <NewAdPlacementForm />
        ) : (
          <p style={{ color: "#9e9e9e" }}>
            Enable monetisation to create new placements.
          </p>
        )}

        {placements.length === 0 ? (
          <p style={{ color: "#9e9e9e" }}>No ad placements configured yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {placements.map((p) => (
              <li key={p.id}>
                <AdPlacementRow placement={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatCents(cents: number): string {
  const rupees = cents / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

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
  verticalAlign: "top",
};
