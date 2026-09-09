import Link from "next/link";
import { redirect } from "next/navigation";
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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#81c784",
  PAUSED: "#ffb74d",
  CLOSED: "#9e9e9e",
};

export default async function ListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const isSeller = SELLER_TYPES.some((type) => user.roles.includes(type));
  const listings = await listSellerListings(user.id);

  // Fetch interests and existing connections per listing so each card can show
  // the interested-buyers panel without a client-side round-trip. A single
  // batched query for connections keeps this O(1); interests are per-listing.
  const connections = await listSellerConnections(user.id);
  const connectionByListing = new Map(
    connections.map((c) => [c.listingId, c] as const),
  );
  const interestsByListing = new Map(
    await Promise.all(
      listings.map(
        async (l) =>
          [l.id, await listListingInterests(user.id, l.id)] as const,
      ),
    ),
  );

  // Resolve the selected collector's phone by joining the connection's
  // collectorId against the interests already fetched for that listing.
  function selectedPhoneFor(listingId: string): string | null {
    const connection = connectionByListing.get(listingId);
    if (!connection) return null;
    const interests = interestsByListing.get(listingId) ?? [];
    const match = interests.find((i) => i.collectorId === connection.collectorId);
    return match?.collectorPhone ?? "buyer";
  }

  return (
    <main>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Your listings</h1>
        {isSeller && (
          <Link href="/listings/new" style={newLinkStyle}>
            + New listing
          </Link>
        )}
      </div>

      {!isSeller && (
        <p>
          Only households and businesses can post listings.{" "}
          <Link href="/register">Add a seller role</Link> to get started.
        </p>
      )}

      {isSeller && listings.length === 0 && (
        <p style={{ color: "#9e9e9e" }}>
          You don&apos;t have any listings yet.{" "}
          <Link href="/listings/new">Create your first one</Link>.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {listings.map((listing) => (
          <li key={listing.id} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{listing.title}</h2>
              <span
                style={{
                  color: STATUS_COLORS[listing.status] ?? "inherit",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {listing.status}
              </span>
            </div>
            <p style={metaStyle}>
              {MATERIAL_LABELS[listing.materialCategory]} · {listing.quantityMin}
              –{listing.quantityMax} {QUANTITY_UNIT_LABELS[listing.quantityUnit]}{" "}
              · {listing.locality} · {AVAILABILITY_LABELS[listing.availability]}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                marginTop: "0.6rem",
              }}
            >
              <ListingActions id={listing.id} status={listing.status} />
              {listing.status !== "CLOSED" && (
                <Link
                  href={`/listings/${listing.id}/edit`}
                  style={{ fontSize: "0.85rem" }}
                >
                  Edit
                </Link>
              )}
            </div>
            <BuyersPanel
              listingId={listing.id}
              interests={interestsByListing.get(listing.id) ?? []}
              selectedCollectorPhone={selectedPhoneFor(listing.id)}
            />
          </li>
        ))}
      </ul>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
    </main>
  );
}

interface BuyersPanelProps {
  listingId: string;
  interests: { id: string; collectorId: string; collectorPhone: string }[];
  selectedCollectorPhone: string | null;
}

// Rendered under each listing: either "Selected: <buyer>" if the seller has
// already picked someone, or the list of interested collectors with a Select
// button next to each.
function BuyersPanel({
  listingId,
  interests,
  selectedCollectorPhone,
}: BuyersPanelProps) {
  if (selectedCollectorPhone) {
    return (
      <p style={selectedStyle}>
        Selected buyer: <strong>{selectedCollectorPhone}</strong>
      </p>
    );
  }
  if (interests.length === 0) {
    return (
      <p style={{ ...metaStyle, marginTop: "0.6rem" }}>No interested buyers yet.</p>
    );
  }
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.4rem" }}>
        Interested buyers
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {interests.map((i) => (
          <li
            key={i.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.3rem 0",
            }}
          >
            <span>{i.collectorPhone}</span>
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

const selectedStyle: React.CSSProperties = {
  color: "#81c784",
  fontSize: "0.9rem",
  margin: "0.6rem 0 0",
};

const newLinkStyle: React.CSSProperties = {
  padding: "0.5rem 0.9rem",
  borderRadius: 6,
  background: "#2e7d32",
  color: "#fff",
  textDecoration: "none",
  fontSize: "0.9rem",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.9rem",
  margin: "0.4rem 0 0",
};
