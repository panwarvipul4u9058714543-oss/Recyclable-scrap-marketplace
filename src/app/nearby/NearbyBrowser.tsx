"use client";

import { useState } from "react";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  type Availability,
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

interface NearbyResult {
  id: string;
  title: string;
  description: string | null;
  materialCategory: MaterialCategory;
  quantityMin: number;
  quantityMax: number;
  quantityUnit: QuantityUnit;
  locality: string;
  availability: Availability;
  distanceKm: number;
}

/** Per-listing state for the "I'm interested" toggle. */
type InterestState = "idle" | "sending" | "done" | "error";

const ALL = "__all__" as const;

export function NearbyBrowser() {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [material, setMaterial] = useState<string>(ALL);
  const [availability, setAvailability] = useState<string>(ALL);
  const [minQuantity, setMinQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<string>(QUANTITY_UNITS[0]);
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [results, setResults] = useState<NearbyResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [interests, setInterests] = useState<Record<string, InterestState>>({});

  async function toggleInterest(listingId: string) {
    const current = interests[listingId] ?? "idle";
    if (current === "sending") return;

    setInterests((prev) => ({ ...prev, [listingId]: "sending" }));
    const method = current === "done" ? "DELETE" : "POST";
    try {
      const res = await fetch(`/api/listings/${listingId}/interests`, {
        method,
      });
      if (!res.ok) {
        setInterests((prev) => ({ ...prev, [listingId]: "error" }));
        return;
      }
      setInterests((prev) => ({
        ...prev,
        [listingId]: method === "POST" ? "done" : "idle",
      }));
    } catch {
      setInterests((prev) => ({ ...prev, [listingId]: "error" }));
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser can't share a location. Enter it manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => setError("Couldn't read your location. Enter it manually."),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (latitude.trim() === "" || longitude.trim() === "") {
      setError("Enter a search location (latitude and longitude).");
      return;
    }
    const params = new URLSearchParams({ lat: latitude, lng: longitude });
    if (material !== ALL) params.set("material", material);
    if (availability !== ALL) params.set("availability", availability);
    if (minQuantity.trim() !== "") {
      params.set("minQuantity", minQuantity);
      params.set("quantityUnit", quantityUnit);
    }
    if (maxDistanceKm.trim() !== "") {
      params.set("maxDistanceKm", maxDistanceKm);
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/discover?${params.toString()}`);
      if (!res.ok) {
        setError(
          res.status === 400
            ? "Please check your filters and try again."
            : "Couldn't load nearby listings. Please try again.",
        );
        setResults(null);
        return;
      }
      const body = (await res.json()) as { results: NearbyResult[] };
      setResults(body.results);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        {error && (
          <p role="alert" style={{ color: "#ff8a80" }}>
            {error}
          </p>
        )}

        <fieldset style={fieldsetStyle}>
          <legend>Search location</legend>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="lat">Latitude</label>
              <input
                id="lat"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lng">Longitude</label>
              <input
                id="lng"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            style={secondaryButtonStyle}
          >
            Use my location
          </button>
        </fieldset>

        <label htmlFor="material">Material</label>
        <select
          id="material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          style={inputStyle}
        >
          <option value={ALL}>Any material</option>
          {MATERIAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {MATERIAL_LABELS[c]}
            </option>
          ))}
        </select>

        <label htmlFor="availability">Availability</label>
        <select
          id="availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          style={inputStyle}
        >
          <option value={ALL}>Any availability</option>
          {AVAILABILITY_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABELS[a]}
            </option>
          ))}
        </select>

        <fieldset style={fieldsetStyle}>
          <legend>Minimum quantity</legend>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="minQuantity">At least</label>
              <input
                id="minQuantity"
                type="number"
                min="0"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="quantityUnit">Unit</label>
              <select
                id="quantityUnit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
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

        <label htmlFor="maxDistanceKm">Maximum distance (km)</label>
        <input
          id="maxDistanceKm"
          type="number"
          min="0"
          step="any"
          value={maxDistanceKm}
          onChange={(e) => setMaxDistanceKm(e.target.value)}
          placeholder="e.g. 10"
          style={inputStyle}
        />

        <button type="submit" disabled={busy} style={primaryButtonStyle}>
          {busy ? "Searching…" : "Show nearby listings"}
        </button>
      </form>

      {results !== null && (
        <section aria-label="Search results" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>
            {results.length === 0
              ? "No nearby listings match those filters."
              : `${results.length} nearby listing${results.length === 1 ? "" : "s"}`}
          </h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {results.map((r) => (
              <li key={r.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "baseline",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{r.title}</h3>
                  <span style={distanceStyle}>{r.distanceKm.toFixed(1)} km</span>
                </div>
                <p style={metaStyle}>
                  {MATERIAL_LABELS[r.materialCategory]} · {r.quantityMin}–
                  {r.quantityMax} {QUANTITY_UNIT_LABELS[r.quantityUnit]} ·{" "}
                  {r.locality} · {AVAILABILITY_LABELS[r.availability]}
                </p>
                <div style={{ marginTop: "0.6rem" }}>
                  {(() => {
                    const state = interests[r.id] ?? "idle";
                    if (state === "done") {
                      return (
                        <button
                          type="button"
                          onClick={() => toggleInterest(r.id)}
                          style={secondaryButtonStyle}
                        >
                          Withdraw interest
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => toggleInterest(r.id)}
                        disabled={state === "sending"}
                        style={primaryButtonStyle}
                      >
                        {state === "sending"
                          ? "Sending…"
                          : state === "error"
                          ? "Try again"
                          : "I'm interested"}
                      </button>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.85rem",
  borderRadius: 6,
  border: "1px solid #444",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  margin: "0 0 0.6rem",
};

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.6rem 1rem 0",
  margin: "0 0 1rem",
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

const distanceStyle: React.CSSProperties = {
  color: "#81c784",
  fontSize: "0.85rem",
  fontWeight: 600,
};
