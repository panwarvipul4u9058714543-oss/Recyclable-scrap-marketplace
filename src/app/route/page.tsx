import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { COLLECTOR_ROLES, ROLE_LABELS } from "@/lib/roles";
import { RouteBrowser } from "./RouteBrowser";

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
      <main>
        <p>
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
        <h1>Route mode</h1>
        <p>
          Route mode is for collectors, dealers and recyclers. Add one of{" "}
          <em>{collectorLabels}</em> to your roles to plan a trip.
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Route mode</h1>
      <p style={{ color: "#9e9e9e" }}>
        Plan a trip you are already making and see marketplace listings that
        fit within an acceptable detour.
      </p>
      <p
        role="note"
        style={{
          background: "#3c2b12",
          border: "1px solid #7c5714",
          borderRadius: 8,
          padding: "0.6rem 0.9rem",
          color: "#ffcc80",
          fontSize: "0.9rem",
        }}
      >
        <strong>Safety first.</strong> Set your route <em>before</em> you start
        driving and review matches after you park. Never tap on route
        results while behind the wheel.
      </p>
      <RouteBrowser />
    </main>
  );
}
