"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type MaterialCategory,
  type QuantityUnit,
} from "@/lib/materials";

interface SavedSearchRow {
  id: string;
  name: string;
  material: MaterialCategory | null;
  supplyMinQuantity: number | null;
  supplyMinQuantityUnit: QuantityUnit | null;
  region: string | null;
  alertsEnabled: boolean;
}

export function SavedSearchesPanel({
  searches: initial,
}: {
  searches: SavedSearchRow[];
}) {
  const router = useRouter();
  const [searches, setSearches] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [material, setMaterial] = useState<MaterialCategory | "">("");
  const [supplyQty, setSupplyQty] = useState("");
  const [supplyUnit, setSupplyUnit] = useState<QuantityUnit>(QUANTITY_UNITS[0]);
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Give the search a short name so you recognise it later.");
      return;
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      material: material === "" ? null : material,
      region: region.trim() === "" ? null : region.trim(),
    };
    if (supplyQty.trim() !== "") {
      const n = Number(supplyQty);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Minimum quantity must be a positive number.");
        return;
      }
      payload.supplyMinQuantity = n;
      payload.supplyMinQuantityUnit = supplyUnit;
    } else {
      payload.supplyMinQuantity = null;
      payload.supplyMinQuantityUnit = null;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError("Couldn't save the search. Please try again.");
        return;
      }
      const body = (await res.json()) as { search: SavedSearchRow };
      setSearches((prev) => [body.search, ...prev]);
      setName("");
      setMaterial("");
      setSupplyQty("");
      setRegion("");
      setShowForm(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlerts(id: string, next: boolean) {
    // Optimistic — flip locally, revert if the server rejects.
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, alertsEnabled: next } : s)),
    );
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alertsEnabled: next }),
    });
    if (!res.ok) {
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, alertsEnabled: !next } : s)),
      );
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this saved search? Alerts you already received will stay.")) {
      return;
    }
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section aria-label="Saved searches" style={{ margin: "1.5rem 0" }}>
      <h2 style={{ fontSize: "1.05rem" }}>Saved searches & alerts</h2>
      <p style={{ color: "#9e9e9e", fontSize: "0.9rem", marginTop: 0 }}>
        Save a supply query and receive an alert whenever a new listing
        matches. Toggle alerts off to pause a search without deleting it.
      </p>

      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        style={secondaryButtonStyle}
      >
        {showForm ? "Cancel" : "+ New saved search"}
      </button>

      {showForm && (
        <form onSubmit={create} style={formStyle}>
          {error && (
            <p role="alert" style={{ color: "#ff8a80" }}>
              {error}
            </p>
          )}
          <label htmlFor="ss-name">Name</label>
          <input
            id="ss-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            style={inputStyle}
          />
          <label htmlFor="ss-material">Material (optional)</label>
          <select
            id="ss-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value as MaterialCategory | "")}
            style={inputStyle}
          >
            <option value="">Any</option>
            {MATERIAL_CATEGORIES.map((m) => (
              <option key={m} value={m}>
                {MATERIAL_LABELS[m]}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="ss-min-qty">Min supplier quantity (optional)</label>
              <input
                id="ss-min-qty"
                type="number"
                min="0"
                step="any"
                value={supplyQty}
                onChange={(e) => setSupplyQty(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="ss-min-unit">Unit</label>
              <select
                id="ss-min-unit"
                value={supplyUnit}
                onChange={(e) => setSupplyUnit(e.target.value as QuantityUnit)}
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
          <label htmlFor="ss-region">Region contains (optional)</label>
          <input
            id="ss-region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Bengaluru"
            maxLength={120}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={primaryButtonStyle}>
            {busy ? "Saving…" : "Save search"}
          </button>
        </form>
      )}

      {searches.length === 0 ? (
        <p style={{ color: "#9e9e9e" }}>
          You haven&apos;t saved any searches yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {searches.map((s) => (
            <li key={s.id} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "baseline",
                }}
              >
                <strong>{s.name}</strong>
                <label style={{ fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={s.alertsEnabled}
                    onChange={(e) => toggleAlerts(s.id, e.target.checked)}
                    style={{ marginRight: "0.35rem" }}
                  />
                  Alerts on
                </label>
              </div>
              <p style={metaStyle}>
                {s.material ? MATERIAL_LABELS[s.material] : "Any material"} ·{" "}
                {s.supplyMinQuantity && s.supplyMinQuantityUnit
                  ? `≥ ${s.supplyMinQuantity} ${QUANTITY_UNIT_LABELS[s.supplyMinQuantityUnit]}`
                  : "Any quantity"}
                {s.region && <> · region contains {s.region}</>}
              </p>
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  style={secondaryButtonStyle}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  padding: "0.5rem 1rem",
  fontSize: "0.95rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.9rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

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

const formStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
  background: "rgba(255,255,255,0.02)",
};
