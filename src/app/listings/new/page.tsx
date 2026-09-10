import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/listings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to your listings
      </Link>
      <PageHeader
        eyebrow="Listings"
        title="New listing"
        description="Describe the scrap, where to collect it, and how much there is. Buyers see the material, quantity range and distance — not your address."
      />

      {sellerTypes.length === 0 ? (
        <Card className="p-6 text-sm text-ash">
          Only households and businesses can post listings.{" "}
          <Link href="/register" className="text-rust underline-offset-4 hover:underline">
            Add a seller role
          </Link>{" "}
          to get started.
        </Card>
      ) : (
        <ListingForm mode="create" sellerTypes={sellerTypes} />
      )}
    </main>
  );
}
