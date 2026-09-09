"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  listingId: string;
  collectorId: string;
  label: string;
}

/**
 * Seller-side "Select" button. POSTs to the select endpoint, then refreshes
 * the RSC tree so the newly-created connection appears without a full reload.
 */
export function SelectBuyerButton({ listingId, collectorId, label }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/select`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectorId }),
      });
      if (!res.ok) {
        setError("Couldn't select this buyer. Please try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          padding: "0.35rem 0.8rem",
          fontSize: "0.85rem",
          borderRadius: 6,
          border: "none",
          background: "#2e7d32",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {busy ? "Selecting…" : label}
      </button>
      {error && (
        <p role="alert" style={{ color: "#ff8a80", marginTop: "0.4rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
