import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  type ConnectionDetailDTO,
  getConnectionDetail,
  listCollectorConnections,
  listSellerConnections,
} from "@/lib/connections/connections";

const STATUS_TONE: Record<string, "moss" | "warn" | "neutral"> = {
  RESERVED: "moss",
  CANCELLED: "warn",
  EXPIRED: "neutral",
  COMPLETED: "moss",
  FAILED: "warn",
};

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const [asSellerRaw, asCollectorRaw] = await Promise.all([
    listSellerConnections(user.id),
    listCollectorConnections(user.id),
  ]);
  const [asSeller, asCollector] = await Promise.all([
    Promise.all(asSellerRaw.map((c) => getConnectionDetail(user.id, c.id))),
    Promise.all(asCollectorRaw.map((c) => getConnectionDetail(user.id, c.id))),
  ]);

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Reservations"
        title="Your connections"
        description="Everything you've reserved on both sides — buyers you've selected, and sellers who've selected you. Contact stays hidden until both sides reveal."
      />

      <div className="grid gap-10">
        <section aria-label="As a seller">
          <h2 className="mb-3 font-serif text-2xl tracking-tight">
            Buyers you selected
          </h2>
          {asSeller.length === 0 ? (
            <Card className="border-dashed p-5 text-sm text-ash">
              You haven&apos;t selected a buyer for any listing yet.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {asSeller.map((c) => (
                <ConnectionRow key={c.id} connection={c} side="seller" />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="As a buyer">
          <h2 className="mb-3 font-serif text-2xl tracking-tight">
            Listings that selected you
          </h2>
          {asCollector.length === 0 ? (
            <Card className="border-dashed p-5 text-sm text-ash">
              No seller has selected you yet.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {asCollector.map((c) => (
                <ConnectionRow key={c.id} connection={c} side="collector" />
              ))}
            </ul>
          )}
        </section>
      </div>
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
    <li>
      <Card className="group p-5 transition hover:-translate-y-px hover:border-ink/30 hover:shadow-lift">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Link
            href={`/connections/${connection.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-sm font-serif text-lg tracking-tight text-ink hover:text-rust"
          >
            {connection.listingTitle}
            <ArrowUpRight className="h-4 w-4 text-ash transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-rust" />
          </Link>
          <Badge tone={STATUS_TONE[connection.status] ?? "neutral"}>
            {connection.status}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ash">
          {counterpartyLabel}:{" "}
          <span className="font-mono text-ink">{counterpartyPhone}</span>
          {!connection.contactRevealed && (
            <span className="text-ash"> (hidden until mutual reveal)</span>
          )}
        </p>
      </Card>
    </li>
  );
}
