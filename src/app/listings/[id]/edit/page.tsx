import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ListingError,
  SELLER_TYPES,
  type SellerType,
  getListingForSeller,
} from "@/lib/listings/listings";
import { ListingForm, type ListingFormValues } from "../../ListingForm";

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  let listing;
  try {
    listing = await getListingForSeller(user.id, params.id);
  } catch (err) {
    if (err instanceof ListingError) notFound();
    throw err;
  }

  const heldTypes = SELLER_TYPES.filter((type) => user.roles.includes(type));
  const sellerTypes = Array.from(
    new Set<SellerType>([listing.sellerType, ...heldTypes]),
  );

  if (listing.status === "CLOSED") {
    return (
      <main className="container-page py-10 sm:py-14">
        <Link
          href="/listings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to your listings
        </Link>
        <PageHeader eyebrow="Listings" title="Edit listing" />
        <Card className="p-6 text-sm text-ash">
          This listing is closed and can no longer be edited.
        </Card>
      </main>
    );
  }

  const initial: ListingFormValues = {
    sellerType: listing.sellerType,
    materialCategory: listing.materialCategory,
    title: listing.title,
    description: listing.description ?? "",
    photos: listing.photos.join("\n"),
    quantityMin: String(listing.quantityMin),
    quantityMax: String(listing.quantityMax),
    quantityUnit: listing.quantityUnit,
    locality: listing.locality,
    latitude: String(listing.latitude),
    longitude: String(listing.longitude),
    availability: listing.availability,
  };

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/listings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to your listings
      </Link>
      <PageHeader eyebrow="Listings" title="Edit listing" />
      <ListingForm
        mode="edit"
        listingId={listing.id}
        sellerTypes={sellerTypes}
        initial={initial}
      />
    </main>
  );
}
