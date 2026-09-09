"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

export function RespondToRequirementForm({
  requirementId,
}: {
  requirementId: string;
}) {
  const router = useRouter();
  const [offeredQuantity, setOfferedQuantity] = useState("");
  const [offeredQuantityUnit, setOfferedQuantityUnit] = useState<QuantityUnit>(
    QUANTITY_UNITS[0],
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okResponseId, setOkResponseId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkResponseId(null);
    const qty = Number(offeredQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Offered quantity must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/bulk-requirements/${requirementId}/responses`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            offeredQuantity: qty,
            offeredQuantityUnit,
            notes: notes.trim() === "" ? null : notes,
          }),
        },
      );
      if (!res.ok) {
        if (res.status === 403) {
          setError(
            "Your account cannot respond to bulk requirements. A collector or dealer role is required.",
          );
        } else if (res.status === 409) {
          setError("This requirement is no longer accepting responses.");
        } else if (res.status === 400) {
          setError("Please check the response details and try again.");
        } else {
          setError("Couldn't submit response. Please try again.");
        }
        return;
      }
      const body = (await res.json()) as {
        response: { id: string };
      };
      setOkResponseId(body.response.id);
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
      {okResponseId && (
        <p role="status" style={{ color: "#81c784" }}>
          Response submitted. The buyer will see it on their requirement.
        </p>
      )}
      <fieldset style={fieldsetStyle}>
        <legend>What you can supply</legend>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="offer-qty">Quantity</label>
            <input
              id="offer-qty"
              type="number"
              min="0"
              step="any"
              value={offeredQuantity}
              onChange={(e) => setOfferedQuantity(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="offer-unit">Unit</label>
            <select
              id="offer-unit"
              value={offeredQuantityUnit}
              onChange={(e) =>
                setOfferedQuantityUnit(e.target.value as QuantityUnit)
              }
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
      <label htmlFor="offer-notes">Notes (optional)</label>
      <textarea
        id="offer-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Grade, cadence, pickup arrangements…"
        style={{ ...inputStyle, height: "auto", fontFamily: "inherit" }}
      />
      <button type="submit" disabled={busy} style={primaryButtonStyle}>
        {busy ? "Submitting…" : "Submit response"}
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
