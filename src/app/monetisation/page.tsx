import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { InlineNote } from "@/components/ui/inline-note";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Paid"
        title="Paid features"
        description="Basic listing and discovery are free for everyone. Professional sellers can pay for optional visibility (promoted listings) or business tools (subscriptions). Direct negotiation and direct payment between buyer and seller stay unchanged."
      />

      {!monetisationOn && (
        <InlineNote tone="warn" className="mb-6">
          Monetisation is currently disabled. Paid features are turned off
          platform-wide until an operator sets{" "}
          <code className="font-mono">MONETISATION_ENABLED=1</code>.
        </InlineNote>
      )}

      {!isPro && (
        <InlineNote tone="warn" className="mb-6">
          Paid features are for dealers, businesses and recyclers. Add one of
          those roles from{" "}
          <Link href="/profile" className="underline underline-offset-4">
            your profile
          </Link>{" "}
          if you have professional scrap operations.
        </InlineNote>
      )}

      <section aria-label="Promoted listings" className="space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Zap className="h-4 w-4 text-rust" /> Promoted listings
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(PROMOTION_TIER_SPECS).map((spec) => (
            <li key={spec.tier}>
              <Card className="h-full p-5">
                <p className="font-serif text-lg tracking-tight text-ink">
                  {spec.label}
                </p>
                <p className="mt-1 font-mono text-xs text-ash">
                  {formatCents(spec.priceCents)} · {spec.durationDays} days
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink/85">
                  {spec.benefit}
                </p>
              </Card>
            </li>
          ))}
        </ul>

        {isPro && monetisationOn && (
          <div className="space-y-2">
            <p className="text-sm text-ash">
              Choose one of your active listings to promote:
            </p>
            {myListings.length === 0 ? (
              <Card className="border-dashed p-4 text-sm text-ash">
                You have no active listings yet.{" "}
                <Link
                  href="/listings/new"
                  className="text-rust underline-offset-4 hover:underline"
                >
                  Create one
                </Link>
                .
              </Card>
            ) : (
              <ul className="grid gap-1.5">
                {myListings.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/monetisation/promote/${l.id}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-sm text-sm text-rust hover:underline"
                    >
                      Promote &ldquo;{l.title}&rdquo; ({l.materialCategory})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isPro && myPromotions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-serif text-lg tracking-tight">
              Your recent promotions
            </h3>
            <ul className="grid gap-1 text-sm text-ash">
              {myPromotions.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <span className="text-ink">{p.tier}</span> · {p.status} ·
                  ends {new Date(p.endsAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="rule my-10" />

      <section aria-label="Business subscriptions" className="space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Sparkles className="h-4 w-4 text-moss" /> Business tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(SUBSCRIPTION_PLAN_SPECS).map((spec) => (
            <li key={spec.plan}>
              <Card className="h-full p-5">
                <p className="font-serif text-lg tracking-tight text-ink">
                  {spec.label}
                </p>
                <p className="mt-1 font-mono text-xs text-ash">
                  {formatCents(spec.priceCents)} · {spec.durationDays} days
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink/85">
                  {spec.benefit}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        {isPro && (
          <p>
            <Link
              href="/monetisation/subscription"
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-rust hover:underline"
            >
              {activeSub
                ? `Manage your ${activeSub.plan} subscription →`
                : "Start a subscription →"}
            </Link>
          </p>
        )}
        {isPro && mySubs.length > 0 && !activeSub && (
          <p className="text-xs text-ash">
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
