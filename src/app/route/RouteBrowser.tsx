"use client";

import { useState } from "react";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
  AVAILABILITY_LABELS,
  type Availability,
} from "@/lib/materials";

interface RouteMatch {
  id: string;
  title: string;
  description: string | null;
  materialCategory: MaterialCategory;
  quantityMin: number;
  quantityMax: number;
  quantityUnit: QuantityUnit;
  locality: string;
  availability: Availability;
  detourKm: number;
}

type InterestState = "idle" | "sending" | "done" | "error";

// Format the "now + Nh" defaults the form pre-fills with so someone can start
// a route with two taps. Uses the viewer's local time zone.
function toLocalInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function defaultDepartAt(): string {
  return toLocalInputValue(new Date());
}

function defaultArriveByAt(): string {
  return toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));
}

export function RouteBrowser() {
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [departAt, setDepartAt] = useState(defaultDepartAt);
  const [arriveByAt, setArriveByAt] = useState(defaultArriveByAt);
  const [maxDetourKm, setMaxDetourKm] = useState("3");
  const [minQuantity, setMinQuantity] = useState("");
  const [minQuantityUnit, setMinQuantityUnit] =
    useState<string>(QUANTITY_UNITS[0]);
  const [materials, setMaterials] = useState<Set<MaterialCategory>>(new Set());
  const [results, setResults] = useState<RouteMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [interests, setInterests] = useState<Record<string, InterestState>>({});

  function toggleMaterial(m: MaterialCategory) {
    setMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);

    if (
      originLat.trim() === "" ||
      originLng.trim() === "" ||
      destLat.trim() === "" ||
      destLng.trim() === ""
    ) {
      setError("Enter both an origin and a destination.");
      return;
    }
    const parsedMaxDetour = Number(maxDetourKm);
    if (!Number.isFinite(parsedMaxDetour) || parsedMaxDetour <= 0) {
      setError("Maximum detour must be a positive number of kilometres.");
      return;
    }
    if (
      minQuantity.trim() !== "" &&
      (!Number.isFinite(Number(minQuantity)) || Number(minQuantity) <= 0)
    ) {
      setError("Minimum quantity must be a positive number.");
      return;
    }

    const payload: Record<string, unknown> = {
      originLatitude: Number(originLat),
      originLongitude: Number(originLng),
      destLatitude: Number(destLat),
      destLongitude: Number(destLng),
      departAt: new Date(departAt).toISOString(),
      arriveByAt: new Date(arriveByAt).toISOString(),
      maxDetourKm: parsedMaxDetour,
      acceptedMaterials: Array.from(materials),
    };
    if (minQuantity.trim() !== "") {
      payload.minQuantity = Number(minQuantity);
      payload.minQuantityUnit = minQuantityUnit;
    }

    setBusy(true);
    try {
      const startRes = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!startRes.ok) {
        if (startRes.status === 400) {
          setError("Please check your route details and try again.");
        } else if (startRes.status === 403) {
          setError("You need a collector-type role to use route mode.");
        } else {
          setError("Couldn't start route mode. Please try again.");
        }
        return;
      }
      const startBody = (await startRes.json()) as {
        route: { id: string };
      };
      const matchesRes = await fetch(
        `/api/routes/${startBody.route.id}/matches`,
      );
      if (!matchesRes.ok) {
        setError("Couldn't load route matches. Please try again.");
        return;
      }
      const matchesBody = (await matchesRes.json()) as {
        matches: RouteMatch[];
      };
      setResults(matchesBody.matches);
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
          <legend>Origin</legend>
          <div
            style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}
          >
            <div style={{ flex: 1 }}>
              <label htmlFor="origin-lat">Origin latitude</label>
              <input
                id="origin-lat"
                type="number"
                step="any"
                value={originLat}
                onChange={(e) => setOriginLat(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="origin-lng">Origin longitude</label>
              <input
                id="origin-lng"
                type="number"
                step="any"
                value={originLng}
                onChange={(e) => setOriginLng(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend>Destination</legend>
          <div
            style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}
          >
            <div style={{ flex: 1 }}>
              <label htmlFor="dest-lat">Destination latitude</label>
              <input
                id="dest-lat"
                type="number"
                step="any"
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="dest-lng">Destination longitude</label>
              <input
                id="dest-lng"
                type="number"
                step="any"
                value={destLng}
                onChange={(e) => setDestLng(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend>Travel window</legend>
          <label htmlFor="depart-at">Departing at</label>
          <input
            id="depart-at"
            type="datetime-local"
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
            style={inputStyle}
          />
          <label htmlFor="arrive-by">Arriving by</label>
          <input
            id="arrive-by"
            type="datetime-local"
            value={arriveByAt}
            onChange={(e) => setArriveByAt(e.target.value)}
            style={inputStyle}
          />
        </fieldset>

        <label htmlFor="max-detour">Maximum detour (km)</label>
        <input
          id="max-detour"
          type="number"
          min="0.1"
          step="any"
          value={maxDetourKm}
          onChange={(e) => setMaxDetourKm(e.target.value)}
          style={inputStyle}
        />

        <fieldset style={fieldsetStyle}>
          <legend>Materials you will accept</legend>
          <p style={{ color: "#9e9e9e", fontSize: "0.85rem", marginTop: 0 }}>
            Leave all unchecked to accept any material.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {MATERIAL_CATEGORIES.map((m) => (
              <label
                key={m}
                style={{
                  display: "inline-flex",
                  gap: "0.35rem",
                  alignItems: "center",
                  padding: "0.25rem 0.4rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={materials.has(m)}
                  onChange={() => toggleMaterial(m)}
                />
                {MATERIAL_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend>Minimum quantity (optional)</legend>
          <div
            style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}
          >
            <div style={{ flex: 1 }}>
              <label htmlFor="min-quantity">At least</label>
              <input
                id="min-quantity"
                type="number"
                min="0"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="min-quantity-unit">Unit</label>
              <select
                id="min-quantity-unit"
                value={minQuantityUnit}
                onChange={(e) => setMinQuantityUnit(e.target.value)}
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

        <button type="submit" disabled={busy} style={primaryButtonStyle}>
          {busy ? "Finding matches…" : "Start route and find matches"}
        </button>
      </form>

      {results !== null && (
        <section aria-label="Route matches" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>
            {results.length === 0
              ? "No listings match this route."
              : `${results.length} listing${results.length === 1 ? "" : "s"} along your route`}
          </h2>
          {results.length > 0 && (
            <p style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>
              Review these when you have parked. Tap <em>I&apos;m interested</em>
              {" "}to let the seller pick you.
            </p>
          )}
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
                  <span style={detourStyle}>
                    +{r.detourKm.toFixed(1)} km detour
                  </span>
                </div>
                <p style={metaStyle}>
                  {MATERIAL_LABELS[r.materialCategory]} · {r.quantityMin}–
                  {r.quantityMax} {QUANTITY_UNIT_LABELS[r.quantityUnit]} ·{" "}
                  {r.locality} · {AVAILABILITY_LABELS[r.availability]}
                </p>
                <div
                  style={{
                    marginTop: "0.6rem",
                    display: "flex",
                    gap: "0.6rem",
                    flexWrap: "wrap",
                  }}
                >
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

const detourStyle: React.CSSProperties = {
  color: "#81c784",
  fontSize: "0.85rem",
  fontWeight: 600,
};
