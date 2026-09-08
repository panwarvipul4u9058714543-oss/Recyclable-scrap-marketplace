import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SELLER_TYPES, listSellerListings } from "@/lib/listings/listings";
import {
  AVAILABILITY_LABELS,
  MATERIAL_LABELS,
  QUANTITY_UNIT_LABELS,
} from "@/lib/materials";
import { ListingActions } from "./ListingActions";

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
          </li>
        ))}
      </ul>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
    </main>
  );
}

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
