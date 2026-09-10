"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineNote } from "@/components/ui/inline-note";
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
      <InlineNote tone="ok">
        {label} activated. It is now boosting this listing in
        nearby-discovery.
      </InlineNote>
    );
  }

  return (
    <div className="space-y-2">
      {error && <InlineNote tone="err">{error}</InlineNote>}
      <Button
        type="button"
        onClick={purchase}
        disabled={busy}
        variant="primary"
        size="sm"
      >
        <Zap className="h-3.5 w-3.5" />
        {busy ? "Purchasing…" : `Purchase ${label}`}
      </Button>
    </div>
  );
}
