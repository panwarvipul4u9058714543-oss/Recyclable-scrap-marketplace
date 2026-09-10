import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Handshake, HandshakeIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  computeReputation,
  getProfileForUser,
} from "@/lib/profiles/profiles";
import { COLLECTOR_ROLES, ROLE_LABELS } from "@/lib/roles";
import { NotificationPreferences } from "./NotificationPreferences";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const [profile, reputation] = await Promise.all([
    getProfileForUser(user.id),
    computeReputation(user.id),
  ]);

  const stats = [
    {
      label: "Completed as seller",
      value: reputation.completedAsSeller,
      Icon: TrendingUp,
      tone: "moss" as const,
    },
    {
      label: "Completed as collector",
      value: reputation.completedAsCollector,
      Icon: Handshake,
      tone: "moss" as const,
    },
    {
      label: "Cancelled or expired",
      value: reputation.cancelledOrExpired,
      Icon: TrendingDown,
      tone: "neutral" as const,
    },
    {
      label: "Failed pickups",
      value: reputation.failed,
      Icon: HandshakeIcon,
      tone: "warn" as const,
    },
  ];

  return (
    <main className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        description={
          <>
            This is what other marketplace users see when they open your public
            profile at{" "}
            <Link
              href={`/u/${user.id}`}
              className="text-rust underline-offset-4 hover:underline"
            >
              /u/{user.id}
            </Link>
            . Your phone number and exact address are never shown here.
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <ProfileForm roles={user.roles} initial={profile} />
          {user.roles.some((r) => COLLECTOR_ROLES.includes(r)) && (
            <NotificationPreferences
              initialNotifyOnRouteMatch={user.notifyOnRouteMatch}
            />
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <section aria-label="Roles">
            <h2 className="mb-3 font-serif text-xl tracking-tight">Your roles</h2>
            {user.roles.length === 0 ? (
              <p className="text-sm text-ash">You have no roles yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <li key={r}>
                    <Badge tone="moss">{ROLE_LABELS[r]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Reputation so far">
            <h2 className="mb-3 font-serif text-xl tracking-tight">
              Reputation so far
            </h2>
            <div className="grid gap-2">
              {stats.map(({ label, value, Icon, tone }) => (
                <Card key={label} className="flex items-center gap-3 p-3">
                  <span
                    className={
                      "inline-flex h-8 w-8 items-center justify-center rounded-md border " +
                      (tone === "moss"
                        ? "border-moss/30 bg-moss-soft text-moss"
                        : tone === "warn"
                          ? "border-signal-warn/30 bg-signal-warn/10 text-signal-warn"
                          : "border-dune bg-sand/60 text-ash")
                    }
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 text-sm text-ink">{label}</span>
                  <span className="font-mono text-sm text-ink">{value}</span>
                </Card>
              ))}
              <Card className="flex items-center gap-3 p-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dune bg-sand/60 text-ash">
                  <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-sm text-ink">Member since</span>
                <span className="font-mono text-sm text-ink">
                  {reputation.memberSince.toISOString().slice(0, 10)}
                </span>
              </Card>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
