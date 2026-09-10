"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <section
      aria-label="Recent saved-search alerts"
      style={{ margin: "1.5rem 0" }}
    >
      <h2 style={{ fontSize: "1.05rem" }}>
        Recent alerts{" "}
        {unseenCount > 0 && (
          <span style={unseenChipStyle}>{unseenCount} new</span>
        )}
      </h2>
      {alerts.length === 0 ? (
        <p style={{ color: "#9e9e9e" }}>
          No matching listings yet. New listings that match one of your saved
          searches will appear here.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {alerts.map((a) => {
            const isNew = a.seenAt === null;
            return (
              <li
                key={a.id}
                style={cardStyle}
                aria-label={isNew ? "New alert" : "Alert"}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "baseline",
                  }}
                >
                  <strong>{a.listing.title}</strong>
                  {isNew && <span style={newBadgeStyle}>NEW</span>}
                </div>
                <p style={metaStyle}>
                  {MATERIAL_LABELS[a.listing.materialCategory]} ·{" "}
                  {a.listing.quantityMin}–{a.listing.quantityMax}{" "}
                  {QUANTITY_UNIT_LABELS[a.listing.quantityUnit]} ·{" "}
                  {a.listing.locality}
                </p>
                {isNew && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => markSeen(a.id)}
                      disabled={busy[a.id]}
                      style={secondaryButtonStyle}
                    >
                      {busy[a.id] ? "Marking…" : "Mark as seen"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9e9e9e",
  fontSize: "0.9rem",
  margin: "0.4rem 0 0",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.85rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const newBadgeStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: "#fff",
  background: "#ff8a65",
  padding: "0.15rem 0.45rem",
  borderRadius: 4,
};

const unseenChipStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.15rem 0.5rem",
  borderRadius: 999,
  background: "#ff8a65",
  color: "#fff",
  marginLeft: "0.5rem",
};
