"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PromotionTier } from "@/lib/monetisation/plans";

interface PromoteListingFormProps {
  listingId: string;
  tier: PromotionTier;
  label: string;
}

export function PromoteListingForm({
  listingId,
  tier,
  label,
}: PromoteListingFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  async function purchase() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/monetisation/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, tier }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "disabled"
            ? "Monetisation is disabled — promotions are turned off."
            : data?.error === "not_professional"
              ? "Promotions are for dealers, businesses and recyclers only."
              : data?.error === "forbidden"
                ? "You can only promote listings you own."
                : "Could not purchase promotion. Try again.",
        );
        return;
      }
      setPurchased(true);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (purchased) {
    return (
      <p style={{ color: "#a5d6a7", margin: 0 }}>
        {label} activated. It is now boosting this listing in nearby-discovery.
      </p>
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
        onClick={purchase}
        disabled={busy}
        style={primaryButtonStyle}
      >
        {busy ? "Purchasing…" : `Purchase ${label}`}
      </button>
    </>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#3949ab",
  color: "#fff",
  cursor: "pointer",
};
