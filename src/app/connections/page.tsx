import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listCollectorConnections,
  listSellerConnections,
  type ConnectionDTO,
} from "@/lib/connections/connections";
import { db } from "@/lib/db";

interface EnrichedConnection extends ConnectionDTO {
  listingTitle: string;
  counterpartyPhone: string;
}

async function enrich(
  connections: ConnectionDTO[],
  counterpartyKey: "sellerId" | "collectorId",
): Promise<EnrichedConnection[]> {
  if (connections.length === 0) return [];
  const listingIds = Array.from(new Set(connections.map((c) => c.listingId)));
  const partyIds = Array.from(new Set(connections.map((c) => c[counterpartyKey])));

  const [listings, parties] = await Promise.all([
    db.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, title: true },
    }),
    db.user.findMany({
      where: { id: { in: partyIds } },
      select: { id: true, phone: true },
    }),
  ]);
  const listingTitle = new Map(listings.map((l) => [l.id, l.title]));
  const partyPhone = new Map(parties.map((p) => [p.id, p.phone]));

  return connections.map((c) => ({
    ...c,
    listingTitle: listingTitle.get(c.listingId) ?? "(deleted listing)",
    counterpartyPhone: partyPhone.get(c[counterpartyKey]) ?? "(deleted user)",
  }));
}

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const [asSellerRaw, asCollectorRaw] = await Promise.all([
    listSellerConnections(user.id),
    listCollectorConnections(user.id),
  ]);
  const [asSeller, asCollector] = await Promise.all([
    enrich(asSellerRaw, "collectorId"),
    enrich(asCollectorRaw, "sellerId"),
  ]);

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Your connections</h1>

      <section aria-label="As a seller">
        <h2 style={sectionHeadingStyle}>Buyers you selected</h2>
        {asSeller.length === 0 ? (
          <p style={emptyStyle}>
            You haven&apos;t selected a buyer for any listing yet.
          </p>
        ) : (
          <ul style={listStyle}>
            {asSeller.map((c) => (
              <li key={c.id} style={cardStyle}>
                <div style={rowStyle}>
                  <strong>{c.listingTitle}</strong>
                  <span style={statusStyle}>{c.status}</span>
                </div>
                <p style={metaStyle}>Buyer: {c.counterpartyPhone}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="As a buyer" style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionHeadingStyle}>Listings that selected you</h2>
        {asCollector.length === 0 ? (
          <p style={emptyStyle}>No seller has selected you yet.</p>
        ) : (
          <ul style={listStyle}>
            {asCollector.map((c) => (
              <li key={c.id} style={cardStyle}>
                <div style={rowStyle}>
                  <strong>{c.listingTitle}</strong>
                  <span style={statusStyle}>{c.status}</span>
                </div>
                <p style={metaStyle}>Seller: {c.counterpartyPhone}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  margin: "1rem 0 0.4rem",
};

const listStyle: React.CSSProperties = { listStyle: "none", padding: 0 };

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.6rem 0",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "1rem",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.9rem",
  margin: "0.4rem 0 0",
};

const statusStyle: React.CSSProperties = {
  color: "#81c784",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const emptyStyle: React.CSSProperties = { color: "#9e9e9e" };
