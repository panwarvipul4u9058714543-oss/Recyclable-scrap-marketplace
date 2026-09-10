import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import {
  SUBSCRIPTION_PLAN_SPECS,
  isProfessionalRole,
} from "@/lib/monetisation/plans";
import { getActiveSubscription } from "@/lib/monetisation/subscriptions";
import { SubscriptionControls } from "./SubscriptionControls";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.roles.some(isProfessionalRole)) notFound();

  const active = await getActiveSubscription(user.id);

  return (
    <main>
      <p>
        <Link href="/monetisation">← Back to paid features</Link>
      </p>
      <h1>Business tools subscription</h1>
      <p style={{ color: "#9e9e9e" }}>
        Optional monthly plan for professional users. Does not change how you
        negotiate or settle payment with counterparties.
      </p>

      {!isMonetisationEnabled() && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          Monetisation is currently disabled — subscriptions are turned off
          until an operator enables it.
        </p>
      )}

      {active ? (
        <section aria-label="Active subscription" style={activeStyle}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {SUBSCRIPTION_PLAN_SPECS[active.plan].label}
          </p>
          <p style={metaStyle}>
            Started {new Date(active.startsAt).toLocaleDateString()} · Renews /
            ends {new Date(active.endsAt).toLocaleDateString()}
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            {SUBSCRIPTION_PLAN_SPECS[active.plan].benefit}
          </p>
          <SubscriptionControls mode="cancel" />
        </section>
      ) : (
        <section aria-label="Available plans">
          <ul style={{ listStyle: "none", padding: 0 }}>
            {Object.values(SUBSCRIPTION_PLAN_SPECS).map((spec) => (
              <li key={spec.plan} style={tileStyle}>
                <p style={{ margin: 0, fontWeight: 600 }}>{spec.label}</p>
                <p style={metaStyle}>
                  {formatCents(spec.priceCents)} · {spec.durationDays} days
                </p>
                <p style={{ margin: "0.4rem 0 0.6rem" }}>{spec.benefit}</p>
                <SubscriptionControls mode="subscribe" plan={spec.plan} />
              </li>
            ))}
          </ul>
        </section>
      )}
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

const tileStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.75rem 0.9rem",
  margin: "0.6rem 0",
};

const activeStyle: React.CSSProperties = {
  border: "1px solid #2e7d32",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.6rem 0",
  background: "#0f2510",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0.3rem 0 0",
};
