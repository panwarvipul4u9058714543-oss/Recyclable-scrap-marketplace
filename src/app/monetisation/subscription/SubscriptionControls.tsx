"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineNote } from "@/components/ui/inline-note";
import type { SubscriptionPlan } from "@/lib/monetisation/plans";

type Props =
  | { mode: "subscribe"; plan: SubscriptionPlan }
  | { mode: "cancel" };

export function SubscriptionControls(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: SubscriptionPlan) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/monetisation/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "disabled"
            ? "Monetisation is disabled — subscriptions are turned off."
            : data?.error === "already_active"
              ? "You already have an active subscription."
              : "Could not start subscription.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/monetisation/subscription", {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not cancel the subscription.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (props.mode === "cancel") {
    return (
      <div className="space-y-2">
        {error && <InlineNote tone="err">{error}</InlineNote>}
        <Button
          type="button"
          onClick={cancel}
          disabled={busy}
          variant="secondary"
          size="sm"
        >
          {busy ? "Cancelling…" : "Cancel subscription"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <InlineNote tone="err">{error}</InlineNote>}
      <Button
        type="button"
        onClick={() => subscribe(props.plan)}
        disabled={busy}
        variant="primary"
        size="sm"
      >
        {busy ? "Subscribing…" : "Subscribe"}
      </Button>
    </div>
  );
}
