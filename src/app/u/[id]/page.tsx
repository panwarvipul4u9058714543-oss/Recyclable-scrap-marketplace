import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listBlockedIds } from "@/lib/blocks/blocks";
import { MATERIAL_LABELS, type MaterialCategory } from "@/lib/materials";
import { ROLE_LABELS } from "@/lib/roles";
import { getPublicProfile } from "@/lib/profiles/profiles";
import { SafetyActions } from "./SafetyActions";

interface PublicProfilePageProps {
  params: { id: string };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const [profile, viewer] = await Promise.all([
    getPublicProfile(params.id),
    getCurrentUser(),
  ]);
  if (!profile) notFound();

  const isSelf = viewer?.id === profile.userId;
  const blockedIds = viewer && !isSelf ? await listBlockedIds(viewer.id) : [];
  const isBlocked = blockedIds.includes(profile.userId);

  const heading = profile.displayName ?? "Marketplace member";
  const memberSinceLabel = profile.reputation.memberSince
    .toISOString()
    .slice(0, 10);
  const ratingLabel =
    profile.reputation.rating.count > 0
      ? `★ ${profile.reputation.rating.average!.toFixed(1)} from ${profile.reputation.rating.count} rating${profile.reputation.rating.count === 1 ? "" : "s"}`
      : "No ratings yet";

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ash hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="Public profile"
        title={heading}
        description={`Member since ${memberSinceLabel}`}
      />

      {profile.isSuspended && (
        <InlineNote tone="err" role="status" className="mb-6">
          This account is currently suspended by an operator.
        </InlineNote>
      )}

      {profile.bio && (
        <section className="mb-6">
          <Card className="p-5">
            <p className="text-[15px] leading-relaxed text-ink/85">
              {profile.bio}
            </p>
          </Card>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <section aria-label="Roles">
            <h2 className="mb-2 font-serif text-xl tracking-tight">Roles</h2>
            {profile.roles.length === 0 ? (
              <p className="text-sm text-ash">No roles set.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {profile.roles.map((r) => (
                  <li key={r}>
                    <Badge tone="moss">{ROLE_LABELS[r]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(profile.organisationName || profile.registrationId) && (
            <section aria-label="Organisation">
              <h2 className="mb-2 font-serif text-xl tracking-tight">
                Organisation &amp; verification
              </h2>
              <Card className="p-5">
                {profile.organisationName && (
                  <p className="text-sm">
                    <strong className="font-medium text-ink">
                      Organisation:
                    </strong>{" "}
                    {profile.organisationName}
                  </p>
                )}
                {profile.registrationId && (
                  <p className="mt-1 text-sm">
                    <strong className="font-medium text-ink">
                      Registration / licence:
                    </strong>{" "}
                    <span className="font-mono">
                      {profile.registrationId}
                    </span>
                  </p>
                )}
              </Card>
            </section>
          )}

          {(profile.serviceAreaLocality ||
            profile.serviceAreaRadiusKm != null ||
            profile.acceptedMaterials.length > 0) && (
            <section aria-label="Service area">
              <h2 className="mb-2 font-serif text-xl tracking-tight">
                Service area &amp; accepted materials
              </h2>
              <Card className="p-5">
                {profile.serviceAreaLocality && (
                  <p className="text-sm">
                    <strong className="font-medium text-ink">
                      Service area:
                    </strong>{" "}
                    {profile.serviceAreaLocality}
                  </p>
                )}
                {profile.serviceAreaRadiusKm != null && (
                  <p className="mt-1 text-sm">
                    <strong className="font-medium text-ink">
                      Will travel:
                    </strong>{" "}
                    up to {profile.serviceAreaRadiusKm} km
                  </p>
                )}
                {profile.acceptedMaterials.length > 0 && (
                  <p className="mt-1 text-sm">
                    <strong className="font-medium text-ink">Accepts:</strong>{" "}
                    {profile.acceptedMaterials
                      .map((c: MaterialCategory) => MATERIAL_LABELS[c])
                      .join(", ")}
                  </p>
                )}
              </Card>
            </section>
          )}

          {viewer && !isSelf && (
            <SafetyActions
              targetUserId={profile.userId}
              initiallyBlocked={isBlocked}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <section aria-label="Reputation">
            <h2 className="mb-2 font-serif text-xl tracking-tight">
              Reputation
            </h2>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-lg text-ink">
                <Star className="h-4 w-4 fill-rust text-rust" />
                <strong className="font-medium">{ratingLabel}</strong>
              </p>
              <ul className="mt-3 grid gap-1 text-sm text-ash">
                <li>
                  Completed pickups as seller:{" "}
                  <span className="font-mono text-ink">
                    {profile.reputation.completedAsSeller}
                  </span>
                </li>
                <li>
                  Completed pickups as collector:{" "}
                  <span className="font-mono text-ink">
                    {profile.reputation.completedAsCollector}
                  </span>
                </li>
                <li>
                  Cancelled or expired:{" "}
                  <span className="font-mono text-ink">
                    {profile.reputation.cancelledOrExpired}
                  </span>
                </li>
                <li>
                  Failed pickups:{" "}
                  <span className="font-mono text-ink">
                    {profile.reputation.failed}
                  </span>
                </li>
              </ul>
            </Card>
          </section>
        </aside>
      </div>

      <p className="mt-8 text-xs text-ash">
        Phone numbers and exact addresses are only shared once both parties
        reveal their contact on an active connection.
      </p>
    </main>
  );
}
