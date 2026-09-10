import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.suspendedAt) redirect("/dashboard");

  return (
    <main className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Account"
        title="Your account is suspended"
        description={
          <span className="flex items-start gap-2">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-signal-err" />
            <span>
              An operator has suspended{" "}
              <strong className="font-mono font-medium">{user.phone}</strong>.
              Until this suspension is lifted you cannot create or edit
              listings, express interest, chat, submit ratings or file reports.
            </span>
          </span>
        }
      />

      {user.suspensionReason && (
        <InlineNote tone="err" className="mb-6">
          <strong className="font-medium">Reason given:</strong>{" "}
          {user.suspensionReason}
        </InlineNote>
      )}

      <Card className="p-5">
        <p className="text-sm text-ash">
          Suspended since{" "}
          <span className="font-mono text-ink">
            {user.suspendedAt ? user.suspendedAt.toLocaleString() : "recently"}
          </span>
          .
        </p>
        <p className="mt-3 text-sm text-ink">
          You can still{" "}
          <Link
            href="/nearby"
            className="text-rust underline-offset-4 hover:underline"
          >
            browse listings
          </Link>{" "}
          and view public profiles while the suspension is in place.
        </p>
      </Card>
    </main>
  );
}
