"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      <>
        {error && (
          <p role="alert" style={{ color: "#ff8a80", margin: "0.4rem 0 0" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          style={secondaryButtonStyle}
        >
          {busy ? "Cancelling…" : "Cancel subscription"}
        </button>
      </>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" style={{ color: "#ff8a80", margin: "0 0 0.4rem" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => subscribe(props.plan)}
        disabled={busy}
        style={primaryButtonStyle}
      >
        {busy ? "Subscribing…" : "Subscribe"}
      </button>
    </>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #666",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
