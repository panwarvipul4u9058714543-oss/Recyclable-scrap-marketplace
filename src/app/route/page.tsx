import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { COLLECTOR_ROLES, ROLE_LABELS } from "@/lib/roles";
import { listNotificationsForCollector } from "@/lib/routes/notifications";
import { RouteBrowser } from "./RouteBrowser";
import { RecentMatches } from "./RecentMatches";

export default async function RoutePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const canRoute = user.roles.some((r) => COLLECTOR_ROLES.includes(r));
  if (!canRoute) {
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
        <PageHeader eyebrow="Route" title="Route mode" />
        <Card className="p-6 text-sm text-ash">
          Route mode is for collectors, dealers and recyclers. Add one of{" "}
          <em>{collectorLabels}</em> to your roles to plan a trip.
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
        eyebrow="Route"
        title="Route mode"
        description="Plan a trip you are already making and see marketplace listings that fit within an acceptable detour."
      />

      <div
        role="note"
        className="mb-6 flex items-start gap-3 rounded-md border border-signal-warn/40 bg-signal-warn/10 px-4 py-3 text-sm text-signal-warn"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="font-medium">Safety first.</strong> Set your route{" "}
          <em>before</em> you start driving and review matches after you park.
          Never tap on route results while behind the wheel.
        </p>
      </div>

      <RouteBrowser />
      <RecentMatches
        notifications={(await listNotificationsForCollector(user.id)).map(
          (n) => ({
            id: n.id,
            seenAt: n.seenAt ? n.seenAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
            listing: {
              id: n.listing.id,
              title: n.listing.title,
              materialCategory: n.listing.materialCategory,
              quantityMin: n.listing.quantityMin,
              quantityMax: n.listing.quantityMax,
              quantityUnit: n.listing.quantityUnit,
              locality: n.listing.locality,
              availability: n.listing.availability,
            },
          }),
        )}
        notifyOnRouteMatch={user.notifyOnRouteMatch}
      />
    </main>
  );
}
