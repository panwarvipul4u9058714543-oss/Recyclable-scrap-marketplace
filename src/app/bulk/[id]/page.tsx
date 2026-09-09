import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBulkRequirement } from "@/lib/bulk/requirements";
import { listResponsesForRequirement } from "@/lib/bulk/responses";
import {
  MATERIAL_LABELS,
  QUANTITY_UNIT_LABELS,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";
import {
  BULK_SUPPLIER_ROLES,
  ROLE_LABELS,
  type Role,
} from "@/lib/roles";
import { RespondToRequirementForm } from "./RespondToRequirementForm";
import { ResponsesList } from "./ResponsesList";

export default async function RequirementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const requirement = await getBulkRequirement(params.id);
  if (!requirement) {
    return (
      <main>
        <p>
          <Link href="/bulk">← Back to bulk marketplace</Link>
        </p>
        <h1>Requirement not found</h1>
        <p>The requirement may have been closed or removed.</p>
      </main>
    );
  }

  const isBuyer = requirement.buyerId === user.id;
  const isSupplier = user.roles.some((r) =>
    (BULK_SUPPLIER_ROLES as readonly Role[]).includes(r),
  );

  const responses = isBuyer
    ? await listResponsesForRequirement(user.id, requirement.id)
    : [];

  return (
    <main>
      <p>
        <Link href={isBuyer ? "/bulk" : "/bulk/browse"}>
          ← Back to {isBuyer ? "your requirements" : "browse"}
        </Link>
      </p>
      <h1>{MATERIAL_LABELS[requirement.material as MaterialCategory]}</h1>
      <p style={{ color: "#9e9e9e" }}>
        Wants at least {requirement.minQuantity}{" "}
        {QUANTITY_UNIT_LABELS[requirement.minQuantityUnit as QuantityUnit]} in{" "}
        {requirement.region}
        {requirement.deadlineAt && (
          <>
            {" "}
            · deadline{" "}
            <time
              dateTime={requirement.deadlineAt.toISOString()}
            >
              {requirement.deadlineAt.toLocaleDateString()}
            </time>
          </>
        )}
        {" "}· status {requirement.status}
      </p>
      {requirement.qualityNotes && (
        <p style={{ margin: "0.4rem 0" }}>{requirement.qualityNotes}</p>
      )}

      <section aria-label="Buyer" style={buyerBadgeStyle}>
        <div>
          <strong>
            {requirement.buyer.organisationName ??
              requirement.buyer.displayName ??
              "Buyer"}
          </strong>{" "}
          <span style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>
            ·{" "}
            {requirement.buyer.roles
              .map((r) => ROLE_LABELS[r])
              .join(", ") || "Buyer"}
          </span>
        </div>
        {requirement.buyer.registrationId && (
          <div style={{ fontSize: "0.85rem", color: "#9e9e9e" }}>
            Registration: <code>{requirement.buyer.registrationId}</code>
          </div>
        )}
        <div style={{ fontSize: "0.85rem", color: "#9e9e9e" }}>
          Completed as buyer: {requirement.buyer.reputation.completedAsCollector}{" "}
          · Failed: {requirement.buyer.reputation.failed}
          {requirement.buyer.reputation.rating.count > 0 && (
            <>
              {" "}
              · Rating{" "}
              {requirement.buyer.reputation.rating.average?.toFixed(1)} (
              {requirement.buyer.reputation.rating.count})
            </>
          )}
        </div>
        <Link href={`/u/${requirement.buyer.id}`} style={{ fontSize: "0.85rem" }}>
          View buyer profile
        </Link>
      </section>

      {!isBuyer && isSupplier && requirement.status === "ACTIVE" && (
        <section
          aria-label="Respond to this requirement"
          style={{ marginTop: "1.5rem" }}
        >
          <h2 style={{ fontSize: "1.05rem" }}>Respond to this requirement</h2>
          <RespondToRequirementForm requirementId={requirement.id} />
        </section>
      )}

      {isBuyer && (
        <section
          aria-label="Responses"
          style={{ marginTop: "1.5rem" }}
        >
          <h2 style={{ fontSize: "1.05rem" }}>
            Responses ({responses.length})
          </h2>
          {responses.length === 0 ? (
            <p style={{ color: "#9e9e9e" }}>
              No supplier has responded yet.
            </p>
          ) : (
            <ResponsesList
              responses={responses.map((r) => ({
                id: r.id,
                offeredQuantity: r.offeredQuantity,
                offeredQuantityUnit: r.offeredQuantityUnit,
                notes: r.notes,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          )}
        </section>
      )}
    </main>
  );
}

const buyerBadgeStyle: React.CSSProperties = {
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  borderRadius: 6,
  background: "#141821",
  border: "1px solid #2a2f3a",
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
};
