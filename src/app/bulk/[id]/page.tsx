import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
      <main className="container-page py-10 sm:py-14">
        <Link
          href="/bulk"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to bulk marketplace
        </Link>
        <PageHeader eyebrow="Bulk" title="Requirement not found" />
        <Card className="p-6 text-sm text-ash">
          The requirement may have been closed or removed.
        </Card>
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
    <main className="container-page py-10 sm:py-14">
      <Link
        href={isBuyer ? "/bulk" : "/bulk/browse"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />{" "}
        Back to {isBuyer ? "your requirements" : "browse"}
      </Link>
      <PageHeader
        eyebrow={isBuyer ? "Requirement · buyer" : "Requirement"}
        title={MATERIAL_LABELS[requirement.material as MaterialCategory]}
        description={
          <>
            Wants at least {requirement.minQuantity}{" "}
            {QUANTITY_UNIT_LABELS[requirement.minQuantityUnit as QuantityUnit]}{" "}
            in {requirement.region}
            {requirement.deadlineAt && (
              <>
                {" "}
                · deadline{" "}
                <time dateTime={requirement.deadlineAt.toISOString()}>
                  {requirement.deadlineAt.toLocaleDateString()}
                </time>
              </>
            )}
            {" · "}status{" "}
            <Badge tone={requirement.status === "ACTIVE" ? "moss" : "neutral"}>
              {requirement.status}
            </Badge>
          </>
        }
      />

      {requirement.qualityNotes && (
        <Card className="mb-6 p-5">
          <p className="text-sm leading-relaxed text-ink/85">
            {requirement.qualityNotes}
          </p>
        </Card>
      )}

      <section aria-label="Buyer" className="mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-moss" />
            <strong className="font-serif text-lg tracking-tight text-ink">
              {requirement.buyer.organisationName ??
                requirement.buyer.displayName ??
                "Buyer"}
            </strong>
            <span className="text-xs text-ash">
              ·{" "}
              {requirement.buyer.roles
                .map((r) => ROLE_LABELS[r])
                .join(", ") || "Buyer"}
            </span>
          </div>
          {requirement.buyer.registrationId && (
            <p className="mt-1 text-sm text-ash">
              Registration:{" "}
              <code className="font-mono text-ink">
                {requirement.buyer.registrationId}
              </code>
            </p>
          )}
          <p className="mt-1 text-sm text-ash">
            Completed as buyer:{" "}
            <span className="font-mono text-ink">
              {requirement.buyer.reputation.completedAsCollector}
            </span>{" "}
            · Failed:{" "}
            <span className="font-mono text-ink">
              {requirement.buyer.reputation.failed}
            </span>
            {requirement.buyer.reputation.rating.count > 0 && (
              <>
                {" "}
                · Rating{" "}
                <span className="font-mono text-ink">
                  {requirement.buyer.reputation.rating.average?.toFixed(1)}
                </span>{" "}
                ({requirement.buyer.reputation.rating.count})
              </>
            )}
          </p>
          <Link
            href={`/u/${requirement.buyer.id}`}
            className="mt-3 inline-flex text-sm text-rust underline-offset-4 hover:underline"
          >
            View buyer profile
          </Link>
        </Card>
      </section>

      {!isBuyer && isSupplier && requirement.status === "ACTIVE" && (
        <section aria-label="Respond to this requirement" className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">
            Respond to this requirement
          </h2>
          <RespondToRequirementForm requirementId={requirement.id} />
        </section>
      )}

      {isBuyer && (
        <section aria-label="Responses" className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">
            Responses ({responses.length})
          </h2>
          {responses.length === 0 ? (
            <Card className="border-dashed p-5 text-sm text-ash">
              No supplier has responded yet.
            </Card>
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
