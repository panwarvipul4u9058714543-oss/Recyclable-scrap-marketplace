import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SELLER_TYPES, type SellerType } from "@/lib/listings/listings";
import { ListingForm } from "../ListingForm";

export default async function NewListingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const sellerTypes = SELLER_TYPES.filter((type) =>
    user.roles.includes(type),
  ) as SellerType[];

  return (
    <main>
      <p>
        <Link href="/listings">← Back to your listings</Link>
      </p>
      <h1>New listing</h1>

      {sellerTypes.length === 0 ? (
        <p>
          Only households and businesses can post listings.{" "}
          <Link href="/register">Add a seller role</Link> to get started.
        </p>
      ) : (
        <ListingForm mode="create" sellerTypes={sellerTypes} />
      )}
    </main>
  );
}
