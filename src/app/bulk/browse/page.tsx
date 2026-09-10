import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdPanel } from "@/app/components/AdPanel";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BULK_SUPPLIER_ROLES, ROLE_LABELS } from "@/lib/roles";
import { BulkBrowser } from "./BulkBrowser";

export default async function BulkBrowsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const canRespond = user.roles.some((r) => BULK_SUPPLIER_ROLES.includes(r));
  if (!canRespond) {
    const labels = BULK_SUPPLIER_ROLES.map((r) => ROLE_LABELS[r]).join(", ");
    return (
      <main className="container-page py-10 sm:py-14">
        <Link
          href="/bulk"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to bulk marketplace
        </Link>
        <PageHeader eyebrow="Bulk" title="Browse bulk requirements" />
        <Card className="p-6 text-sm text-ash">
          Only <em>{labels}</em> can respond to bulk requirements. Add one of
          those roles to browse and respond.
        </Card>
      </main>
    );
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/bulk"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to bulk marketplace
      </Link>
      <PageHeader
        eyebrow="Bulk"
        title="Browse bulk requirements"
        description="Buyer verification signals are visible on every card — organisation name, registration ID and reputation — so you can gauge risk before making contact."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <BulkBrowser />
        </div>
        <aside className="lg:sticky lg:top-24">
          <AdPanel surface="BULK_BROWSE" />
        </aside>
      </div>
    </main>
  );
}
