import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listBulkRequirementsForBuyer } from "@/lib/bulk/requirements";
import { BULK_BUYER_ROLES, BULK_SUPPLIER_ROLES, ROLE_LABELS } from "@/lib/roles";
import { BulkRequirementForm } from "./BulkRequirementForm";
import { BulkRequirementList } from "./BulkRequirementList";

export default async function BulkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const canPublish = user.roles.some((r) => BULK_BUYER_ROLES.includes(r));
  const canRespond = user.roles.some((r) => BULK_SUPPLIER_ROLES.includes(r));

  if (!canPublish && !canRespond) {
    const publisherLabels = BULK_BUYER_ROLES.map((r) => ROLE_LABELS[r]).join(
      ", ",
    );
    return (
      <main>
        <p>
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
        <h1>Bulk marketplace</h1>
        <p>
          Bulk publishing is for <em>{publisherLabels}</em>. Small collectors
          and dealers can respond to matching requirements — add one of those
          roles to take part.
        </p>
      </main>
    );
  }

  const mine = canPublish
    ? await listBulkRequirementsForBuyer(user.id)
    : [];

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Bulk marketplace</h1>
      <p style={{ color: "#9e9e9e" }}>
        The bulk marketplace surfaces potential supply for larger and recurring
        needs. The platform does not aggregate lots or arrange transport — it
        connects a buyer with a supplier, then the same connection lifecycle
        the rest of the marketplace uses (interest → selection → chat → mutual
        contact reveal → outcome) takes over.
      </p>

      {canRespond && (
        <p>
          <Link href="/bulk/browse" style={ctaStyle}>
            Browse bulk buy requirements
          </Link>
        </p>
      )}

      {canPublish && (
        <>
          <section
            aria-label="Publish a bulk requirement"
            style={{ margin: "1.5rem 0" }}
          >
            <h2 style={{ fontSize: "1.05rem" }}>Publish a bulk requirement</h2>
            <BulkRequirementForm />
          </section>

          <section
            aria-label="Your bulk requirements"
            style={{ margin: "1.5rem 0" }}
          >
            <h2 style={{ fontSize: "1.05rem" }}>Your bulk requirements</h2>
            {mine.length === 0 ? (
              <p style={{ color: "#9e9e9e" }}>
                You haven&apos;t published any bulk requirements yet.
              </p>
            ) : (
              <BulkRequirementList
                requirements={mine.map((r) => ({
                  id: r.id,
                  material: r.material,
                  minQuantity: r.minQuantity,
                  minQuantityUnit: r.minQuantityUnit,
                  region: r.region,
                  qualityNotes: r.qualityNotes,
                  deadlineAt: r.deadlineAt ? r.deadlineAt.toISOString() : null,
                  status: r.status,
                }))}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.55rem 1rem",
  borderRadius: 6,
  background: "#2e7d32",
  color: "#fff",
  textDecoration: "none",
};
