import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/monetisation"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to paid features
      </Link>
      <PageHeader
        eyebrow="Paid"
        title="Business tools subscription"
        description="Optional monthly plan for professional users. Does not change how you negotiate or settle payment with counterparties."
      />

      {!isMonetisationEnabled() && (
        <InlineNote tone="err" className="mb-6">
          Monetisation is currently disabled — subscriptions are turned off
          until an operator enables it.
        </InlineNote>
      )}

      {active ? (
        <section aria-label="Active subscription">
          <Card className="border-moss/40 bg-moss-soft/60 p-6">
            <p className="font-serif text-xl tracking-tight text-ink">
              {SUBSCRIPTION_PLAN_SPECS[active.plan].label}
            </p>
            <p className="mt-1 text-xs text-ash">
              Started {new Date(active.startsAt).toLocaleDateString()} · Renews
              / ends {new Date(active.endsAt).toLocaleDateString()}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/85">
              {SUBSCRIPTION_PLAN_SPECS[active.plan].benefit}
            </p>
            <div className="mt-4">
              <SubscriptionControls mode="cancel" />
            </div>
          </Card>
        </section>
      ) : (
        <section aria-label="Available plans">
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
                  <div className="mt-4">
                    <SubscriptionControls mode="subscribe" plan={spec.plan} />
                  </div>
                </Card>
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
