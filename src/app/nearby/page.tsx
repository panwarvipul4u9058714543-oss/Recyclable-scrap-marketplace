import Link from "next/link";
import { redirect } from "next/navigation";
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
      <main>
        <p>
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
        <h1>Nearby listings</h1>
        <p>
          Nearby discovery is for collectors, dealers and recyclers. Add one of{" "}
          <em>{collectorLabels}</em> to your roles to browse listings.
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Nearby listings</h1>
      <p style={{ color: "#9e9e9e" }}>
        Enter your search location and pick the filters that matter to you.
      </p>
      <NearbyBrowser />
    </main>
  );
}
