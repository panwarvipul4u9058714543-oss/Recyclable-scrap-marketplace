import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { isMonetisationEnabled } from "@/lib/monetisation/config";
import {
  PROMOTION_TIER_SPECS,
  isProfessionalRole,
} from "@/lib/monetisation/plans";
import { PromoteListingForm } from "./PromoteListingForm";

export const dynamic = "force-dynamic";

interface PromotePageProps {
  params: { listingId: string };
}

export default async function PromoteListingPage({ params }: PromotePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.roles.some(isProfessionalRole)) notFound();

  const listing = await db.listing.findUnique({
    where: { id: params.listingId },
    select: {
      id: true,
      sellerId: true,
      title: true,
      status: true,
      materialCategory: true,
      locality: true,
    },
  });
  if (!listing || listing.sellerId !== user.id) notFound();

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/monetisation"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to paid features
      </Link>
      <PageHeader
        eyebrow="Promote"
        title={`Promote “${listing.title}”`}
        description={`${listing.materialCategory} · ${listing.locality} · ${listing.status}`}
      />

      {!isMonetisationEnabled() && (
        <InlineNote tone="err" className="mb-6">
          Monetisation is currently disabled — promotion purchases are refused
          until an operator turns it back on.
        </InlineNote>
      )}

      <p className="mb-6 text-sm leading-relaxed text-ink/85">
        Pick a promotion tier. The promotion boosts this listing in
        nearby-discovery and marks it with a Promoted/Featured badge; it does
        NOT change how the buyer contacts you or how you settle payment.
      </p>

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
              <div className="mt-4">
                <PromoteListingForm
                  listingId={listing.id}
                  tier={spec.tier}
                  label={spec.label}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
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
