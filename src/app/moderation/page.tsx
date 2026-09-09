import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  listOpenReportsWithContext,
  listSuspendedUsers,
} from "@/lib/moderation/moderation";
import { ReportRow } from "./ReportRow";
import { SuspendedRow } from "./SuspendedRow";

/**
 * Operator moderation queue. Only accounts with the `isAdmin` flag can
 * reach this page; anyone else gets a 404 so we never confirm the surface
 * exists.
 */
export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.isAdmin) notFound();

  const [reports, suspended] = await Promise.all([
    listOpenReportsWithContext(user.id),
    listSuspendedUsers(user.id),
  ]);

  return (
    <main>
      <h1>Moderation queue</h1>
      <p style={{ color: "#9e9e9e" }}>
        Review open reports and suspend accounts for repeated no-shows,
        harassment, fraud or unsafe behaviour.
      </p>

      <section aria-label="Open reports" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>
          Open reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p>No open reports.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
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

      <section aria-label="Suspended accounts" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>
          Suspended accounts ({suspended.length})
        </h2>
        {suspended.length === 0 ? (
          <p>No suspended accounts.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
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
