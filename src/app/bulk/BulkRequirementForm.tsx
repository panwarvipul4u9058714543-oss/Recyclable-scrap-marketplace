"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

// Local-time YYYY-MM-DDTHH:MM value for a datetime-local default. Uses the
// viewer's time zone so "in two weeks" reads correctly for them.
function toLocalInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function defaultDeadline(): string {
  return toLocalInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
}

export function BulkRequirementForm() {
  const router = useRouter();
  const [material, setMaterial] = useState<MaterialCategory>(
    MATERIAL_CATEGORIES[0],
  );
  const [minQuantity, setMinQuantity] = useState("");
  const [minQuantityUnit, setMinQuantityUnit] = useState<QuantityUnit>(
    QUANTITY_UNITS[0],
  );
  const [qualityNotes, setQualityNotes] = useState("");
  const [region, setRegion] = useState("");
  const [deadlineAt, setDeadlineAt] = useState<string>(defaultDeadline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(minQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Minimum quantity must be a positive number.");
      return;
    }
    if (region.trim().length < 2) {
      setError("Enter a service area (region).");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/bulk-requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          material,
          minQuantity: qty,
          minQuantityUnit,
          qualityNotes: qualityNotes.trim() === "" ? null : qualityNotes,
          region: region.trim(),
          deadlineAt:
            deadlineAt.trim() === ""
              ? null
              : new Date(deadlineAt).toISOString(),
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError(
            "Your account cannot publish bulk requirements. A dealer, business or recycler role is required.",
          );
        } else if (res.status === 400) {
          setError("Please check the requirement details and try again.");
        } else {
          setError("Couldn't publish the requirement. Please try again.");
        }
        return;
      }
      setMinQuantity("");
      setQualityNotes("");
      setRegion("");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}
      <label htmlFor="bulk-material">Material</label>
      <select
        id="bulk-material"
        value={material}
        onChange={(e) => setMaterial(e.target.value as MaterialCategory)}
        style={inputStyle}
      >
        {MATERIAL_CATEGORIES.map((m) => (
          <option key={m} value={m}>
            {MATERIAL_LABELS[m]}
          </option>
        ))}
      </select>

      <fieldset style={fieldsetStyle}>
        <legend>Minimum quantity you need</legend>
        <div
          style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}
        >
          <div style={{ flex: 1 }}>
            <label htmlFor="bulk-min-qty">At least</label>
            <input
              id="bulk-min-qty"
              type="number"
              min="0"
              step="any"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="bulk-min-qty-unit">Unit</label>
            <select
              id="bulk-min-qty-unit"
              value={minQuantityUnit}
              onChange={(e) => setMinQuantityUnit(e.target.value as QuantityUnit)}
              style={inputStyle}
            >
              {QUANTITY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {QUANTITY_UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <label htmlFor="bulk-region">Region (service area)</label>
      <input
        id="bulk-region"
        type="text"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        maxLength={120}
        placeholder="e.g. Bengaluru South"
        style={inputStyle}
      />

      <label htmlFor="bulk-quality">Quality notes (optional)</label>
      <textarea
        id="bulk-quality"
        value={qualityNotes}
        onChange={(e) => setQualityNotes(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Grade, cleanliness, sorting expectations…"
        style={{ ...inputStyle, height: "auto", fontFamily: "inherit" }}
      />

      <label htmlFor="bulk-deadline">Deadline (optional)</label>
      <input
        id="bulk-deadline"
        type="datetime-local"
        value={deadlineAt}
        onChange={(e) => setDeadlineAt(e.target.value)}
        style={inputStyle}
      />

      <button type="submit" disabled={busy} style={primaryButtonStyle}>
        {busy ? "Publishing…" : "Publish requirement"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.55rem",
  margin: "0.35rem 0 1rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "#1a1d23",
  color: "inherit",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.6rem 1rem 0",
  margin: "0 0 1rem",
};
