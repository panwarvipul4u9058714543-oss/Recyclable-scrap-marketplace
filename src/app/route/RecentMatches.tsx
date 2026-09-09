"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      <section
        aria-label="Recent route matches"
        style={{ marginTop: "2rem" }}
      >
        <h2 style={{ fontSize: "1.05rem" }}>Recent route matches</h2>
        {notifyOnRouteMatch ? (
          <p style={{ color: "#9e9e9e", fontSize: "0.9rem" }}>
            No new listings match your active route yet. Anything posted while
            your route is open will appear here.
          </p>
        ) : (
          <p style={{ color: "#ffb74d", fontSize: "0.9rem" }}>
            Route-match notifications are turned off. Turn them back on from
            your <a href="/profile">profile</a>.
          </p>
        )}
      </section>
    );
  }

  const unseen = notifications.filter((n) => !n.seenAt).length;

  return (
    <section aria-label="Recent route matches" style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.05rem" }}>
        Recent route matches{" "}
        {unseen > 0 && (
          <span
            aria-label={`${unseen} unseen`}
            style={{
              display: "inline-block",
              marginLeft: 6,
              padding: "0.05rem 0.5rem",
              background: "#2e7d32",
              color: "#fff",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {unseen} new
          </span>
        )}
      </h2>
      {!notifyOnRouteMatch && (
        <p style={{ color: "#ffb74d", fontSize: "0.85rem" }}>
          Notifications are off — no new rows will be added. Turn them back on
          from your <a href="/profile">profile</a>.
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {notifications.map((n) => (
          <li
            key={n.id}
            aria-label={n.seenAt ? "Route match" : "New route match"}
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: "0.8rem 1rem",
              margin: "0.6rem 0",
              background: n.seenAt ? "transparent" : "#12291a",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "baseline",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{n.listing.title}</h3>
              {!n.seenAt && (
                <span
                  style={{
                    color: "#81c784",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  NEW
                </span>
              )}
            </div>
            <p style={{ color: "#9e9e9e", fontSize: "0.9rem", margin: "0.4rem 0 0" }}>
              {MATERIAL_LABELS[n.listing.materialCategory]} ·{" "}
              {n.listing.quantityMin}–{n.listing.quantityMax}{" "}
              {QUANTITY_UNIT_LABELS[n.listing.quantityUnit]} ·{" "}
              {n.listing.locality} ·{" "}
              {AVAILABILITY_LABELS[n.listing.availability]}
            </p>
            {!n.seenAt && (
              <div style={{ marginTop: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => markSeen(n.id)}
                  disabled={busy === n.id}
                  style={{
                    padding: "0.4rem 0.9rem",
                    fontSize: "0.85rem",
                    borderRadius: 6,
                    border: "1px solid #444",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {busy === n.id ? "Marking…" : "Mark as seen"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
