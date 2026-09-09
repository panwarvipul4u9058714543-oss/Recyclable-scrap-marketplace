import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  type ConnectionDetailDTO,
  getConnectionDetail,
  listCollectorConnections,
  listSellerConnections,
} from "@/lib/connections/connections";

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const [asSellerRaw, asCollectorRaw] = await Promise.all([
    listSellerConnections(user.id),
    listCollectorConnections(user.id),
  ]);
  // Use getConnectionDetail so the same masking rule (exact phone only after
  // both parties reveal) applies consistently across the list and the
  // per-connection page.
  const [asSeller, asCollector] = await Promise.all([
    Promise.all(asSellerRaw.map((c) => getConnectionDetail(user.id, c.id))),
    Promise.all(asCollectorRaw.map((c) => getConnectionDetail(user.id, c.id))),
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
              <ConnectionRow key={c.id} connection={c} side="seller" />
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
              <ConnectionRow key={c.id} connection={c} side="collector" />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ConnectionRow({
  connection,
  side,
}: {
  connection: ConnectionDetailDTO;
  side: "seller" | "collector";
}) {
  const counterpartyLabel = side === "seller" ? "Buyer" : "Seller";
  const counterpartyPhone =
    side === "seller" ? connection.collectorPhone : connection.sellerPhone;
  return (
    <li style={cardStyle}>
      <div style={rowStyle}>
        <Link href={`/connections/${connection.id}`} style={titleLinkStyle}>
          {connection.listingTitle}
        </Link>
        <span style={statusStyleFor(connection.status)}>{connection.status}</span>
      </div>
      <p style={metaStyle}>
        {counterpartyLabel}: {counterpartyPhone}
        {!connection.contactRevealed && " (hidden until mutual reveal)"}
      </p>
    </li>
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

const titleLinkStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "inherit",
  textDecoration: "none",
};

function statusStyleFor(status: string): React.CSSProperties {
  const color =
    status === "RESERVED"
      ? "#81c784"
      : status === "CANCELLED"
      ? "#ff8a80"
      : "#9e9e9e";
  return { color, fontSize: "0.85rem", fontWeight: 600 };
}

const emptyStyle: React.CSSProperties = { color: "#9e9e9e" };
