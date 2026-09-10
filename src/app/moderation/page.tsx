import { notFound, redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listOpenReportsWithContext,
  listSuspendedUsers,
} from "@/lib/moderation/moderation";
import { ReportRow } from "./ReportRow";
import { SuspendedRow } from "./SuspendedRow";

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.isAdmin) notFound();

  const [reports, suspended] = await Promise.all([
    listOpenReportsWithContext(user.id),
    listSuspendedUsers(user.id),
  ]);

  return (
    <main className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Admin"
        title="Moderation queue"
        description={
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-rust" />
            Review open reports and suspend accounts for repeated no-shows,
            harassment, fraud or unsafe behaviour.
          </span>
        }
      />

      <section aria-label="Open reports" className="space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">
          Open reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <Card className="border-dashed p-5 text-sm text-ash">
            No open reports.
          </Card>
        ) : (
          <ul className="grid gap-3">
            {reports.map((r) => (
              <li key={r.id}>
                <ReportRow
                  report={{
                    id: r.id,
                    reason: r.reason,
                    details: r.details,
                    targetLabel: r.targetLabel,
                    targetUserId: r.targetUserId,
                    targetUserSuspended: r.targetUserSuspended,
                    reporterPhone: r.reporterPhone,
                    createdAt: r.createdAt.toISOString(),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rule my-10" />

      <section aria-label="Suspended accounts" className="space-y-3">
        <h2 className="font-serif text-2xl tracking-tight">
          Suspended accounts ({suspended.length})
        </h2>
        {suspended.length === 0 ? (
          <Card className="border-dashed p-5 text-sm text-ash">
            No suspended accounts.
          </Card>
        ) : (
          <ul className="grid gap-3">
            {suspended.map((s) => (
              <li key={s.id}>
                <SuspendedRow
                  user={{
                    id: s.id,
                    phone: s.phone,
                    suspendedAt: s.suspendedAt?.toISOString() ?? null,
                    suspensionReason: s.suspensionReason,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
