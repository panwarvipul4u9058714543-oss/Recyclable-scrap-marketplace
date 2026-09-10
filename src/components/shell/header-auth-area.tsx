"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  phone: string | null;
  isAdmin: boolean;
};

export function HeaderAuthArea({ phone, isAdmin }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!phone) {
    return (
      <Link href="/register" className="focus-ring inline-flex">
        <Button size="sm" variant="primary">
          Get started
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-mono text-xs text-ash sm:inline">
        {phone}
        {isAdmin ? <span className="ml-1 text-rust">·admin</span> : null}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={signOut}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
