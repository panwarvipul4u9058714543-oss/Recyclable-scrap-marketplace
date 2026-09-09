import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listBlockedIds } from "@/lib/blocks/blocks";
import {
  MATERIAL_LABELS,
  type MaterialCategory,
} from "@/lib/materials";
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
    <main>
      <p style={{ margin: 0 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>{heading}</h1>
      <p style={{ color: "#9e9e9e", marginTop: "-0.4rem" }}>
        Member since {memberSinceLabel}
      </p>

      {profile.bio && (
        <section style={{ margin: "0.5rem 0 1rem" }}>
          <p style={{ margin: 0 }}>{profile.bio}</p>
        </section>
      )}

      <section aria-label="Roles" style={{ margin: "1rem 0" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Roles</h2>
        <p style={{ margin: 0 }}>
          {profile.roles.length === 0
            ? "No roles set."
            : profile.roles.map((r) => ROLE_LABELS[r]).join(", ")}
        </p>
      </section>

      {(profile.organisationName || profile.registrationId) && (
        <section aria-label="Organisation" style={{ margin: "1rem 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Organisation &amp; verification</h2>
          {profile.organisationName && (
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Organisation:</strong> {profile.organisationName}
            </p>
          )}
          {profile.registrationId && (
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Registration / licence:</strong> {profile.registrationId}
            </p>
          )}
        </section>
      )}

      {(profile.serviceAreaLocality ||
        profile.serviceAreaRadiusKm != null ||
        profile.acceptedMaterials.length > 0) && (
        <section aria-label="Service area" style={{ margin: "1rem 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Service area &amp; accepted materials</h2>
          {profile.serviceAreaLocality && (
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Service area:</strong> {profile.serviceAreaLocality}
            </p>
          )}
          {profile.serviceAreaRadiusKm != null && (
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Will travel:</strong> up to {profile.serviceAreaRadiusKm} km
            </p>
          )}
          {profile.acceptedMaterials.length > 0 && (
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Accepts:</strong>{" "}
              {profile.acceptedMaterials
                .map((c: MaterialCategory) => MATERIAL_LABELS[c])
                .join(", ")}
            </p>
          )}
        </section>
      )}

      <section aria-label="Reputation" style={{ margin: "1rem 0" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Reputation</h2>
        <p style={{ margin: "0 0 0.4rem", fontSize: "1.1rem" }}>
          <strong>{ratingLabel}</strong>
        </p>
        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
          <li>Completed pickups as seller: {profile.reputation.completedAsSeller}</li>
          <li>
            Completed pickups as collector:{" "}
            {profile.reputation.completedAsCollector}
          </li>
          <li>Cancelled or expired: {profile.reputation.cancelledOrExpired}</li>
          <li>Failed pickups: {profile.reputation.failed}</li>
        </ul>
      </section>

      {viewer && !isSelf && (
        <SafetyActions
          targetUserId={profile.userId}
          initiallyBlocked={isBlocked}
        />
      )}

      <p style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>
        Phone numbers and exact addresses are only shared once both parties
        reveal their contact on an active connection.
      </p>
    </main>
  );
}
