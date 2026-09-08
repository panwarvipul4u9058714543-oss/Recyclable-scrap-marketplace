import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  COLLECTOR_ROLES,
  ROLE_LABELS,
  SELLER_ROLES,
  type Role,
} from "@/lib/roles";
import { LogoutButton } from "./logout-button";

// Role-specific guidance shown on the dashboard. Each role sees a short
// description and the CTAs relevant to that role — sellers get listings,
// collector-type roles get nearby-discovery.
const ROLE_ACTIONS: Record<Role, string> = {
  HOUSEHOLD: "Create a listing for scrap you want collected.",
  BUSINESS: "List recurring recyclable scrap from your premises.",
  COLLECTOR: "Browse nearby listings and plan your collection route.",
  DEALER: "Find bulk scrap from households and businesses near you.",
  RECYCLER: "Source sorted recyclable material from dealers and collectors.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const canSell = user.roles.some((r) => SELLER_ROLES.includes(r));
  const canBrowse = user.roles.some((r) => COLLECTOR_ROLES.includes(r));

  return (
    <main>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Your dashboard</h1>
        <LogoutButton />
      </div>
      <p>
        Signed in as <strong>{user.phone}</strong>
      </p>

      <h2>Your roles</h2>
      {user.roles.length === 0 ? (
        <p>
          You haven&apos;t picked a role yet.{" "}
          <Link href="/register">Choose your roles</Link>.
        </p>
      ) : (
        <ul>
          {user.roles.map((role) => (
            <li key={role}>
              <strong>{ROLE_LABELS[role]}</strong> — {ROLE_ACTIONS[role]}
            </li>
          ))}
        </ul>
      )}

      {(canSell || canBrowse) && (
        <section aria-label="Your actions" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem" }}>What you can do</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {canSell && (
              <Link href="/listings" style={ctaStyle}>
                Manage your listings
              </Link>
            )}
            {canBrowse && (
              <Link href="/nearby" style={ctaStyle}>
                Browse nearby listings
              </Link>
            )}
          </div>
        </section>
      )}

      {!canSell && !canBrowse && (
        <p style={{ marginTop: "1.5rem", color: "#9e9e9e" }}>
          Pick a role to unlock the workflows that fit it.
        </p>
      )}
    </main>
  );
}

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.55rem 1rem",
  borderRadius: 6,
  background: "#2e7d32",
  color: "#fff",
  textDecoration: "none",
};
