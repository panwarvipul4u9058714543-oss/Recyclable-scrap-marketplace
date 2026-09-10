"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  listingId: string;
  collectorId: string;
  label: string;
}

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
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={onClick}
        disabled={busy}
        variant="primary"
        size="sm"
      >
        {busy ? "Selecting…" : label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-signal-err">
          {error}
        </p>
      )}
    </div>
  );
}
