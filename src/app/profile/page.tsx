import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/roles";
import {
  computeReputation,
  getProfileForUser,
} from "@/lib/profiles/profiles";
import { COLLECTOR_ROLES } from "@/lib/roles";
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

  return (
    <main>
      <h1>Your profile</h1>
      <p style={{ color: "#9e9e9e" }}>
        This is what other marketplace users see when they open your public
        profile at <Link href={`/u/${user.id}`}>/u/{user.id}</Link>. Your phone
        number and exact address are never shown here.
      </p>

      <section style={{ margin: "1rem 0 1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Reputation so far</h2>
        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
          <li>Completed as seller: {reputation.completedAsSeller}</li>
          <li>Completed as collector: {reputation.completedAsCollector}</li>
          <li>Cancelled or expired: {reputation.cancelledOrExpired}</li>
          <li>Failed pickups: {reputation.failed}</li>
          <li>
            Member since:{" "}
            {reputation.memberSince.toISOString().slice(0, 10)}
          </li>
        </ul>
      </section>

      <section aria-label="Roles" style={{ margin: "1rem 0" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Your roles</h2>
        <p style={{ margin: 0 }}>
          {user.roles.length === 0
            ? "You have no roles yet."
            : user.roles.map((r) => ROLE_LABELS[r]).join(", ")}
        </p>
      </section>

      <ProfileForm roles={user.roles} initial={profile} />

      {user.roles.some((r) => COLLECTOR_ROLES.includes(r)) && (
        <NotificationPreferences
          initialNotifyOnRouteMatch={user.notifyOnRouteMatch}
        />
      )}
    </main>
  );
}
