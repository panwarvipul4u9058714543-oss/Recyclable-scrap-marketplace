import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listListingInterests,
  listSellerConnections,
} from "@/lib/connections/connections";
import { SELLER_TYPES, listSellerListings } from "@/lib/listings/listings";
import {
  AVAILABILITY_LABELS,
  MATERIAL_LABELS,
  QUANTITY_UNIT_LABELS,
} from "@/lib/materials";
import { ListingActions } from "./ListingActions";
import { SelectBuyerButton } from "./SelectBuyerButton";

const STATUS_TONE: Record<string, "moss" | "warn" | "neutral"> = {
  ACTIVE: "moss",
  PAUSED: "warn",
  CLOSED: "neutral",
};

export default async function ListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const isSeller = SELLER_TYPES.some((type) => user.roles.includes(type));
  const listings = await listSellerListings(user.id);

  const connections = await listSellerConnections(user.id);
  const activeConnectionByListing = new Map(
    connections
      .filter((c) => c.status === "RESERVED")
      .map((c) => [c.listingId, c] as const),
  );
  const interestsByListing = new Map(
    await Promise.all(
      listings.map(
        async (l) =>
          [l.id, await listListingInterests(user.id, l.id)] as const,
      ),
    ),
  );

  function selectedPhoneFor(listingId: string): string | null {
    const connection = activeConnectionByListing.get(listingId);
    if (!connection) return null;
    const interests = interestsByListing.get(listingId) ?? [];
    const match = interests.find((i) => i.collectorId === connection.collectorId);
    return match?.collectorPhone ?? "buyer";
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Seller"
        title="Your listings"
        description="Everything you've posted, with the interested buyers and reservation state on each. Pause when your stock is running low; close a listing once collection is done."
        actions={
          isSeller ? (
            <Link href="/listings/new" className="focus-ring inline-flex">
              <Button variant="primary">
                <Plus className="h-4 w-4" />+ New listing
              </Button>
            </Link>
          ) : null
        }
      />

      {!isSeller && (
        <Card className="p-6 text-sm text-ash">
          Only households and businesses can post listings.{" "}
          <Link href="/register" className="text-rust underline-offset-4 hover:underline">
            Add a seller role
          </Link>{" "}
          to get started.
        </Card>
      )}

      {isSeller && listings.length === 0 && (
        <Card className="border-dashed p-6 text-sm text-ash">
          You don&apos;t have any listings yet.{" "}
          <Link href="/listings/new" className="text-rust underline-offset-4 hover:underline">
            Create your first one
          </Link>
          .
        </Card>
      )}

      <ul className="mt-2 grid gap-3">
        {listings.map((listing) => (
          <li key={listing.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl tracking-tight text-ink">
                  {listing.title}
                </h2>
                <span className="inline-flex items-center gap-2">
                  <Badge tone={STATUS_TONE[listing.status] ?? "neutral"}>
                    {listing.status}
                  </Badge>
                </span>
              </div>
              <p className="mt-2 text-sm text-ash">
                <span className="text-ink">
                  {MATERIAL_LABELS[listing.materialCategory]}
                </span>{" "}
                · {listing.quantityMin}–{listing.quantityMax}{" "}
                {QUANTITY_UNIT_LABELS[listing.quantityUnit]} · {listing.locality}{" "}
                · {AVAILABILITY_LABELS[listing.availability]}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ListingActions id={listing.id} status={listing.status} />
                {listing.status !== "CLOSED" && (
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="focus-ring rounded-sm text-sm text-rust hover:underline"
                  >
                    Edit
                  </Link>
                )}
              </div>
              <BuyersPanel
                listingId={listing.id}
                interests={interestsByListing.get(listing.id) ?? []}
                selectedCollectorPhone={selectedPhoneFor(listing.id)}
                activeConnectionId={
                  activeConnectionByListing.get(listing.id)?.id ?? null
                }
              />
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}

interface BuyersPanelProps {
  listingId: string;
  interests: { id: string; collectorId: string; collectorPhone: string }[];
  selectedCollectorPhone: string | null;
  activeConnectionId: string | null;
}

function BuyersPanel({
  listingId,
  interests,
  selectedCollectorPhone,
  activeConnectionId,
}: BuyersPanelProps) {
  if (selectedCollectorPhone && activeConnectionId) {
    return (
      <div className="mt-4 rounded-md border border-moss/30 bg-moss-soft px-4 py-3 text-sm text-moss">
        Reserved for <strong className="font-medium">{selectedCollectorPhone}</strong> —{" "}
        <Link
          href={`/connections/${activeConnectionId}`}
          className="underline underline-offset-4 hover:no-underline"
        >
          open the connection
        </Link>{" "}
        to chat, reveal contact, or cancel.
      </div>
    );
  }
  if (interests.length === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-ash">
        <UsersRound className="h-3.5 w-3.5" /> No interested buyers yet.
      </p>
    );
  }
  return (
    <div className="mt-4 border-t border-dune/60 pt-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ash">
        <UsersRound className="h-3 w-3" /> Interested buyers
      </h3>
      <ul className="grid divide-y divide-dune/60">
        {interests.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span className="font-mono text-sm text-ink">{i.collectorPhone}</span>
            <SelectBuyerButton
              listingId={listingId}
              collectorId={i.collectorId}
              label="Select"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
