import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdPanel } from "@/app/components/AdPanel";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { COLLECTOR_ROLES, ROLE_LABELS } from "@/lib/roles";
import { NearbyBrowser } from "./NearbyBrowser";

export default async function NearbyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");

  const canBrowse = user.roles.some((r) => COLLECTOR_ROLES.includes(r));
  if (!canBrowse) {
    const collectorLabels = COLLECTOR_ROLES.map((r) => ROLE_LABELS[r]).join(
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
        <PageHeader
          eyebrow="Discovery"
          title="Nearby listings"
          description={
            <>
              Nearby discovery is for collectors, dealers and recyclers to
              browse what&apos;s on the ground close to them. Add one of{" "}
              <em>{collectorLabels}</em> to your roles to browse listings.
            </>
          }
        />
        <Card className="p-6 text-sm text-ash">
          You currently have no role that unlocks discovery. Update your roles
          from the{" "}
          <Link href="/profile" className="text-rust underline-offset-4 hover:underline">
            profile page
          </Link>
          .
        </Card>
      </main>
    );
  }

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Discovery"
        title="Nearby listings"
        description="Enter your search location and pick the filters that matter to you. Distances are calculated from the coordinates below."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <NearbyBrowser />
        </div>
        <aside className="lg:sticky lg:top-24">
          <AdPanel surface="DISCOVERY" />
        </aside>
      </div>
    </main>
  );
}
