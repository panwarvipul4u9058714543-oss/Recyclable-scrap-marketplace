"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AVAILABILITY_LABELS,
  type Availability,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

interface NotificationSummary {
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
    availability: Availability;
  };
}

export function RecentMatches({
  notifications,
  notifyOnRouteMatch,
}: {
  notifications: NotificationSummary[];
  notifyOnRouteMatch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function markSeen(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/route-notifications/${id}/seen`, {
        method: "POST",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (notifications.length === 0) {
    return (
      <section aria-label="Recent route matches" className="mt-10 space-y-3">
        <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
          <Bell className="h-4 w-4 text-ash" /> Recent route matches
        </h2>
        <Card className="border-dashed p-5 text-sm text-ash">
          {notifyOnRouteMatch ? (
            <>
              No new listings match your active route yet. Anything posted
              while your route is open will appear here.
            </>
          ) : (
            <span className="text-signal-warn">
              Route-match notifications are turned off. Turn them back on from
              your{" "}
              <a href="/profile" className="underline underline-offset-4">
                profile
              </a>
              .
            </span>
          )}
        </Card>
      </section>
    );
  }

  const unseen = notifications.filter((n) => !n.seenAt).length;

  return (
    <section aria-label="Recent route matches" className="mt-10 space-y-3">
      <h2 className="flex items-center gap-2 font-serif text-2xl tracking-tight">
        <Bell className="h-4 w-4 text-ash" /> Recent route matches
        {unseen > 0 && (
          <Badge tone="rust" aria-label={`${unseen} unseen`}>
            {unseen} new
          </Badge>
        )}
      </h2>
      {!notifyOnRouteMatch && (
        <p className="text-sm text-signal-warn">
          Notifications are off — no new rows will be added. Turn them back on
          from your{" "}
          <a href="/profile" className="underline underline-offset-4">
            profile
          </a>
          .
        </p>
      )}
      <ul className="grid gap-3">
        {notifications.map((n) => (
          <li
            key={n.id}
            aria-label={n.seenAt ? "Route match" : "New route match"}
          >
            <Card
              className={
                n.seenAt ? "p-5" : "border-rust/40 bg-rust-soft/40 p-5"
              }
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-serif text-lg tracking-tight text-ink">
                  {n.listing.title}
                </h3>
                {!n.seenAt && <Badge tone="rust">NEW</Badge>}
              </div>
              <p className="mt-2 text-sm text-ash">
                <span className="text-ink">
                  {MATERIAL_LABELS[n.listing.materialCategory]}
                </span>{" "}
                · {n.listing.quantityMin}–{n.listing.quantityMax}{" "}
                {QUANTITY_UNIT_LABELS[n.listing.quantityUnit]} ·{" "}
                {n.listing.locality} ·{" "}
                {AVAILABILITY_LABELS[n.listing.availability]}
              </p>
              {!n.seenAt && (
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={() => markSeen(n.id)}
                    disabled={busy === n.id}
                    variant="secondary"
                    size="sm"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {busy === n.id ? "Marking…" : "Mark as seen"}
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
