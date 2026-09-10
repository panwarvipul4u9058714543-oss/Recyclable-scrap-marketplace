import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import {
  PROMOTION_TIER_SPECS,
  SUBSCRIPTION_PLAN_SPECS,
  isProfessionalRole,
} from "@/lib/monetisation/plans";
import {
  getActiveSubscription,
  listSubscriptionsForUser,
} from "@/lib/monetisation/subscriptions";
import { listPromotionsForUser } from "@/lib/monetisation/promotions";

export const dynamic = "force-dynamic";

/**
 * Public monetisation catalog. Explains what each paid feature provides
 * (issue #8: "clearly identify what visibility or workflow benefit"),
 * links to the promote and subscription flows for professional users, and
 * shows a disabled banner when monetisation is off so callers see why the
 * flows are unavailable.
 */
export default async function MonetisationCatalogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const monetisationOn = isMonetisationEnabled();
  const isPro = user.roles.some(isProfessionalRole);

  const [myListings, activeSub, mySubs, myPromotions] = await Promise.all([
    isPro
      ? db.listing.findMany({
          where: { sellerId: user.id, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, materialCategory: true },
        })
      : Promise.resolve([]),
    isPro ? getActiveSubscription(user.id) : Promise.resolve(null),
    isPro ? listSubscriptionsForUser(user.id) : Promise.resolve([]),
    isPro ? listPromotionsForUser(user.id) : Promise.resolve([]),
  ]);

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Paid features</h1>
      <p style={{ color: "#9e9e9e" }}>
        Basic listing and discovery are free for everyone. Professional
        sellers can pay for optional visibility (promoted listings) or
        business tools (subscriptions). Direct negotiation and direct
        payment between buyer and seller stay unchanged.
      </p>

      {!monetisationOn && (
        <div style={bannerStyle}>
          Monetisation is currently disabled. Paid features are turned off
          platform-wide until an operator sets{" "}
          <code>MONETISATION_ENABLED=1</code>.
        </div>
      )}

      {!isPro && (
        <div style={bannerStyle}>
          Paid features are for dealers, businesses and recyclers. Add one of
          those roles from{" "}
          <Link href="/profile">your profile</Link> if you have professional
          scrap operations.
        </div>
      )}

      <section aria-label="Promoted listings" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Promoted listings</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.values(PROMOTION_TIER_SPECS).map((spec) => (
            <li key={spec.tier} style={tileStyle}>
              <p style={{ margin: 0, fontWeight: 600 }}>{spec.label}</p>
              <p style={metaStyle}>
                {formatCents(spec.priceCents)} · {spec.durationDays} days
              </p>
              <p style={{ margin: "0.4rem 0 0" }}>{spec.benefit}</p>
            </li>
          ))}
        </ul>

        {isPro && monetisationOn && (
          <div style={{ marginTop: "0.6rem" }}>
            <p style={metaStyle}>Choose one of your active listings to promote:</p>
            {myListings.length === 0 ? (
              <p style={metaStyle}>
                You have no active listings yet.{" "}
                <Link href="/listings/new">Create one</Link>.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {myListings.map((l) => (
                  <li key={l.id} style={{ padding: "0.25rem 0" }}>
                    <Link href={`/monetisation/promote/${l.id}`}>
                      Promote &ldquo;{l.title}&rdquo; ({l.materialCategory})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isPro && myPromotions.length > 0 && (
          <div style={{ marginTop: "0.6rem" }}>
            <h3 style={{ fontSize: "1rem" }}>Your recent promotions</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {myPromotions.slice(0, 5).map((p) => (
                <li key={p.id} style={metaStyle}>
                  {p.tier} · {p.status} · ends{" "}
                  {new Date(p.endsAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Business subscriptions" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Business tools</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {Object.values(SUBSCRIPTION_PLAN_SPECS).map((spec) => (
            <li key={spec.plan} style={tileStyle}>
              <p style={{ margin: 0, fontWeight: 600 }}>{spec.label}</p>
              <p style={metaStyle}>
                {formatCents(spec.priceCents)} · {spec.durationDays} days
              </p>
              <p style={{ margin: "0.4rem 0 0" }}>{spec.benefit}</p>
            </li>
          ))}
        </ul>
        {isPro && (
          <p style={{ marginTop: "0.6rem" }}>
            <Link href="/monetisation/subscription">
              {activeSub
                ? `Manage your ${activeSub.plan} subscription →`
                : "Start a subscription →"}
            </Link>
          </p>
        )}
        {isPro && mySubs.length > 0 && !activeSub && (
          <p style={metaStyle}>
            Last subscription ended{" "}
            {new Date(mySubs[0].endsAt).toLocaleDateString()}.
          </p>
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

const bannerStyle: React.CSSProperties = {
  marginTop: "0.8rem",
  padding: "0.7rem 0.9rem",
  border: "1px solid #4a4a20",
  borderRadius: 8,
  background: "#2a2a10",
  color: "#fff59d",
};

const tileStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.75rem 0.9rem",
  margin: "0.5rem 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0.3rem 0 0",
};
