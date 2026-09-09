import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "@/app/dashboard/logout-button";

/**
 * Landing page for a signed-in user whose account has been suspended. Every
 * write path in the app refuses their calls with a `suspended` error; this
 * page tells them why and shows the operator-provided reason.
 */
export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/register");
  if (!user.suspendedAt) redirect("/dashboard");

  return (
    <main>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Your account is suspended</h1>
        <LogoutButton />
      </div>
      <p>
        An operator has suspended <strong>{user.phone}</strong>. Until this
        suspension is lifted you cannot create or edit listings, express
        interest, chat, submit ratings or file reports.
      </p>
      {user.suspensionReason && (
        <p>
          <strong>Reason given:</strong> {user.suspensionReason}
        </p>
      )}
      <p style={{ color: "#9e9e9e" }}>
        Suspended since{" "}
        {user.suspendedAt ? user.suspendedAt.toLocaleString() : "recently"}.
      </p>
      <p>
        You can still <Link href="/nearby">browse listings</Link> and view
        public profiles while the suspension is in place.
      </p>
    </main>
  );
}
