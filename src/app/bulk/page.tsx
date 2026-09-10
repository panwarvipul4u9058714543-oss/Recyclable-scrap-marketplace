import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listBulkRequirementsForBuyer } from "@/lib/bulk/requirements";
import { listResponsesForSupplier } from "@/lib/bulk/responses";
import {
  listSavedSearchAlertsForBuyer,
  listSavedSearchesForBuyer,
} from "@/lib/bulk/saved-searches";
import { BULK_BUYER_ROLES, BULK_SUPPLIER_ROLES, ROLE_LABELS } from "@/lib/roles";
import { BulkRequirementForm } from "./BulkRequirementForm";
import { BulkRequirementList } from "./BulkRequirementList";
import { SavedSearchAlerts } from "./SavedSearchAlerts";
import { SavedSearchesPanel } from "./SavedSearchesPanel";
import { SupplierResponsesList } from "./SupplierResponsesList";

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
      <main className="container-page py-10 sm:py-14">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <PageHeader eyebrow="Bulk" title="Bulk marketplace" />
        <Card className="p-6 text-sm text-ash">
          Bulk publishing is for <em>{publisherLabels}</em>. Small collectors
          and dealers can respond to matching requirements — add one of those
          roles to take part.
        </Card>
      </main>
    );
  }

  const mine = canPublish ? await listBulkRequirementsForBuyer(user.id) : [];
  const myResponses = canRespond ? await listResponsesForSupplier(user.id) : [];
  const savedSearches = canPublish
    ? await listSavedSearchesForBuyer(user.id)
    : [];
  const savedSearchAlerts = canPublish
    ? await listSavedSearchAlertsForBuyer(user.id)
    : [];

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Bulk"
        title="Bulk marketplace"
        description="Surfaces potential supply for larger and recurring needs. The platform introduces buyers and suppliers, then the same connection lifecycle the rest of the marketplace uses — interest → selection → chat → mutual contact reveal → outcome — takes over."
      />

      <div className="grid gap-10">
        {canRespond && (
          <section className="space-y-4">
            <div>
              <Link href="/bulk/browse" className="focus-ring inline-flex">
                <Button variant="primary" size="lg" className="group">
                  <Boxes className="h-4 w-4" />
                  Browse bulk buy requirements
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
            {myResponses.length > 0 && (
              <section aria-label="Your bulk responses" className="space-y-3">
                <h2 className="font-serif text-2xl tracking-tight">
                  Your responses
                </h2>
                <SupplierResponsesList
                  responses={myResponses.map((r) => ({
                    id: r.id,
                    requirementId: r.requirementId,
                    offeredQuantity: r.offeredQuantity,
                    offeredQuantityUnit: r.offeredQuantityUnit,
                    status: r.status,
                  }))}
                />
              </section>
            )}
          </section>
        )}

        {canPublish && (
          <>
            <section aria-label="Publish a bulk requirement" className="space-y-3">
              <h2 className="font-serif text-2xl tracking-tight">
                Publish a bulk requirement
              </h2>
              <BulkRequirementForm />
            </section>

            <SavedSearchesPanel
              searches={savedSearches.map((s) => ({
                id: s.id,
                name: s.name,
                material: s.material,
                supplyMinQuantity: s.supplyMinQuantity,
                supplyMinQuantityUnit: s.supplyMinQuantityUnit,
                region: s.region,
                alertsEnabled: s.alertsEnabled,
              }))}
            />
            <SavedSearchAlerts
              alerts={savedSearchAlerts.map((a) => ({
                id: a.id,
                seenAt: a.seenAt ? a.seenAt.toISOString() : null,
                createdAt: a.createdAt.toISOString(),
                listing: {
                  id: a.listing.id,
                  title: a.listing.title,
                  materialCategory: a.listing.materialCategory,
                  quantityMin: a.listing.quantityMin,
                  quantityMax: a.listing.quantityMax,
                  quantityUnit: a.listing.quantityUnit,
                  locality: a.listing.locality,
                },
              }))}
            />
            <section aria-label="Your bulk requirements" className="space-y-3">
              <h2 className="font-serif text-2xl tracking-tight">
                Your bulk requirements
              </h2>
              {mine.length === 0 ? (
                <Card className="border-dashed p-5 text-sm text-ash">
                  You haven&apos;t published any bulk requirements yet.
                </Card>
              ) : (
                <BulkRequirementList
                  requirements={mine.map((r) => ({
                    id: r.id,
                    material: r.material,
                    minQuantity: r.minQuantity,
                    minQuantityUnit: r.minQuantityUnit,
                    region: r.region,
                    qualityNotes: r.qualityNotes,
                    deadlineAt: r.deadlineAt
                      ? r.deadlineAt.toISOString()
                      : null,
                    status: r.status,
                  }))}
                />
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
