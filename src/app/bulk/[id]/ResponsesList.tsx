"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUANTITY_UNIT_LABELS, type QuantityUnit } from "@/lib/materials";

interface ResponseRow {
  id: string;
  offeredQuantity: number;
  offeredQuantityUnit: QuantityUnit;
  notes: string | null;
  status:
    | "PENDING"
    | "WITHDRAWN"
    | "SELECTED"
    | "CANCELLED"
    | "COMPLETED"
    | "FAILED";
  createdAt: string;
}

export function ResponsesList({
  responses,
}: {
  responses: ResponseRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const hasSelected = responses.some((r) => r.status === "SELECTED");

  async function select(id: string) {
    setBusy((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/bulk-responses/${id}/select`, {
        method: "POST",
      });
      if (!res.ok) {
        if (res.status === 409) {
          setError("Another response is already selected on this requirement.");
        } else {
          setError("Couldn't select this response. Please try again.");
        }
        return;
      }
      router.refresh();
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {responses.map((r) => (
          <li key={r.id} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "baseline",
              }}
            >
              <strong>
                Offers {r.offeredQuantity}{" "}
                {QUANTITY_UNIT_LABELS[r.offeredQuantityUnit]}
              </strong>
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color:
                    r.status === "SELECTED"
                      ? "#81c784"
                      : r.status === "PENDING"
                        ? "#ffcc80"
                        : "#9e9e9e",
                }}
              >
                {r.status}
              </span>
            </div>
            {r.notes && (
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
                {r.notes}
              </p>
            )}
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.6rem" }}>
              {r.status === "PENDING" && !hasSelected && (
                <button
                  type="button"
                  onClick={() => select(r.id)}
                  disabled={busy[r.id]}
                  style={primaryButtonStyle}
                >
                  {busy[r.id] ? "Selecting…" : "Select this supplier"}
                </button>
              )}
              {(r.status === "SELECTED" ||
                r.status === "COMPLETED" ||
                r.status === "FAILED" ||
                r.status === "CANCELLED") && (
                <Link href={`/bulk/responses/${r.id}`} style={secondaryLinkStyle}>
                  Open response
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.4rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  textDecoration: "none",
};
