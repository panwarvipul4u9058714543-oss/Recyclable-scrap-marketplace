import Link from "next/link";
import { redirect } from "next/navigation";
import { AdPanel } from "@/app/components/AdPanel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BULK_SUPPLIER_ROLES, ROLE_LABELS } from "@/lib/roles";
import { BulkBrowser } from "./BulkBrowser";

export default async function BulkBrowsePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (user.suspendedAt) redirect("/suspended");

  const canRespond = user.roles.some((r) => BULK_SUPPLIER_ROLES.includes(r));
  if (!canRespond) {
    const labels = BULK_SUPPLIER_ROLES.map((r) => ROLE_LABELS[r]).join(", ");
    return (
      <main>
        <p>
          <Link href="/bulk">← Back to bulk marketplace</Link>
        </p>
        <h1>Browse bulk requirements</h1>
        <p>
          Only <em>{labels}</em> can respond to bulk requirements. Add one of
          those roles to browse and respond.
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/bulk">← Back to bulk marketplace</Link>
      </p>
      <h1>Browse bulk requirements</h1>
      <p style={{ color: "#9e9e9e" }}>
        Buyer verification signals are visible on every card — organisation
        name, registration ID and reputation — so you can gauge risk before
        making contact.
      </p>
      <BulkBrowser />
      <AdPanel surface="BULK_BROWSE" />
    </main>
  );
}
