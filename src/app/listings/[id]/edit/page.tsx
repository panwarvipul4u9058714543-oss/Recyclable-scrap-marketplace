import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

  // Offer the seller types the user holds, always including the one already on
  // the listing so the current value stays selectable.
  const heldTypes = SELLER_TYPES.filter((type) => user.roles.includes(type));
  const sellerTypes = Array.from(
    new Set<SellerType>([listing.sellerType, ...heldTypes]),
  );

  if (listing.status === "CLOSED") {
    return (
      <main>
        <p>
          <Link href="/listings">← Back to your listings</Link>
        </p>
        <h1>Edit listing</h1>
        <p style={{ color: "#9e9e9e" }}>
          This listing is closed and can no longer be edited.
        </p>
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
    <main>
      <p>
        <Link href="/listings">← Back to your listings</Link>
      </p>
      <h1>Edit listing</h1>
      <ListingForm
        mode="edit"
        listingId={listing.id}
        sellerTypes={sellerTypes}
        initial={initial}
      />
    </main>
  );
}
