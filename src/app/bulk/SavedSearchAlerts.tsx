"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MATERIAL_LABELS,
  QUANTITY_UNIT_LABELS,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";

interface AlertRow {
  id: string;
  seenAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    materialCategory: MaterialCategory;
    quantityMin: number;
    quantityMax: number;
    quantityUnit: QuantityUnit;
    locality: string;
  };
}

export function SavedSearchAlerts({ alerts }: { alerts: AlertRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const unseenCount = alerts.filter((a) => a.seenAt === null).length;

  async function markSeen(id: string) {
    setBusy((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/saved-search-alerts/${id}/seen`, {
        method: "POST",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <section aria-label="Recent saved-search alerts" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Bell className="h-4 w-4 text-ash" /> Recent alerts
          {unseenCount > 0 && (
            <Badge tone="rust">{unseenCount} new</Badge>
          )}
        </h2>
      </div>
      {alerts.length === 0 ? (
        <Card className="border-dashed p-5 text-sm text-ash">
          No matching listings yet. New listings that match one of your saved
          searches will appear here.
        </Card>
      ) : (
        <ul className="grid gap-3">
          {alerts.map((a) => {
            const isNew = a.seenAt === null;
            return (
              <li key={a.id} aria-label={isNew ? "New alert" : "Alert"}>
                <Card className={isNew ? "border-rust/40 bg-rust-soft/40 p-5" : "p-5"}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <strong className="font-serif text-lg tracking-tight text-ink">
                      {a.listing.title}
                    </strong>
                    {isNew && <Badge tone="rust">NEW</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-ash">
                    <span className="text-ink">
                      {MATERIAL_LABELS[a.listing.materialCategory]}
                    </span>{" "}
                    · {a.listing.quantityMin}–{a.listing.quantityMax}{" "}
                    {QUANTITY_UNIT_LABELS[a.listing.quantityUnit]} ·{" "}
                    {a.listing.locality}
                  </p>
                  {isNew && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        onClick={() => markSeen(a.id)}
                        disabled={busy[a.id]}
                        variant="secondary"
                        size="sm"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {busy[a.id] ? "Marking…" : "Mark as seen"}
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
