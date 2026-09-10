"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineNote } from "@/components/ui/inline-note";

interface SuspendedRowProps {
  user: {
    id: string;
    phone: string;
    suspendedAt: string | null;
    suspensionReason: string | null;
  };
}

export function SuspendedRow({ user }: SuspendedRowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reinstate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not reinstate.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      aria-label="Suspended account"
      className="rounded-lg border border-dune/70 bg-paper p-5 shadow-soft"
    >
      <p className="text-[15px] text-ink">
        <strong className="font-mono font-medium">{user.phone}</strong> — suspended{" "}
        {user.suspendedAt
          ? new Date(user.suspendedAt).toLocaleString()
          : "(unknown)"}
      </p>
      {user.suspensionReason && (
        <p className="mt-2 text-sm text-ink/85">
          Reason: {user.suspensionReason}
        </p>
      )}
      {error && <InlineNote tone="err" className="mt-3">{error}</InlineNote>}
      <div className="mt-4">
        <Button
          type="button"
          onClick={reinstate}
          disabled={busy}
          variant="secondary"
          size="sm"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {busy ? "Reinstating…" : "Reinstate"}
        </Button>
      </div>
    </article>
  );
}
