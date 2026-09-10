import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    <main>
      <p>
        <Link href="/monetisation">← Back to paid features</Link>
      </p>
      <h1>Promote &ldquo;{listing.title}&rdquo;</h1>
      <p style={{ color: "#9e9e9e" }}>
        {listing.materialCategory} · {listing.locality} · {listing.status}
      </p>

      {!isMonetisationEnabled() && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          Monetisation is currently disabled — promotion purchases are refused
          until an operator turns it back on.
        </p>
      )}

      <p style={{ marginTop: "1rem" }}>
        Pick a promotion tier. The promotion boosts this listing in
        nearby-discovery and marks it with a Promoted/Featured badge; it does
        NOT change how the buyer contacts you or how you settle payment.
      </p>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {Object.values(PROMOTION_TIER_SPECS).map((spec) => (
          <li key={spec.tier} style={tileStyle}>
            <p style={{ margin: 0, fontWeight: 600 }}>{spec.label}</p>
            <p style={metaStyle}>
              {formatCents(spec.priceCents)} · {spec.durationDays} days
            </p>
            <p style={{ margin: "0.4rem 0 0.6rem" }}>{spec.benefit}</p>
            <PromoteListingForm
              listingId={listing.id}
              tier={spec.tier}
              label={spec.label}
            />
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

const tileStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.75rem 0.9rem",
  margin: "0.6rem 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.85rem",
  margin: "0.3rem 0 0",
};
