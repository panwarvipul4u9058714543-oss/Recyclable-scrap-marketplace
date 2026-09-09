"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

interface RequirementRow {
  id: string;
  material: MaterialCategory;
  minQuantity: number;
  minQuantityUnit: QuantityUnit;
  region: string;
  qualityNotes: string | null;
  deadlineAt: string | null;
  status: "ACTIVE" | "CLOSED";
}

export function BulkRequirementList({
  requirements,
}: {
  requirements: RequirementRow[];
}) {
  const router = useRouter();
  const [closing, setClosing] = useState<Record<string, boolean>>({});

  async function close(id: string) {
    setClosing((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/bulk-requirements/${id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setClosing((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {requirements.map((r) => (
        <li key={r.id} style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "baseline",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>
              {MATERIAL_LABELS[r.material]}
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color: r.status === "ACTIVE" ? "#81c784" : "#9e9e9e",
              }}
            >
              {r.status}
            </span>
          </div>
          <p style={metaStyle}>
            At least {r.minQuantity} {QUANTITY_UNIT_LABELS[r.minQuantityUnit]}{" "}
            · {r.region}
            {r.deadlineAt && (
              <>
                {" "}
                · by{" "}
                <time dateTime={r.deadlineAt}>
                  {new Date(r.deadlineAt).toLocaleDateString()}
                </time>
              </>
            )}
          </p>
          {r.qualityNotes && (
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
              {r.qualityNotes}
            </p>
          )}
          {r.status === "ACTIVE" && (
            <div style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                onClick={() => close(r.id)}
                disabled={closing[r.id]}
                style={secondaryButtonStyle}
              >
                {closing[r.id] ? "Closing…" : "Close requirement"}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
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
