"use client";

import { useState } from "react";
import { Compass, Heart, MapPin, Route as RouteIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [minQuantityUnit, setMinQuantityUnit] = useState<string>(QUANTITY_UNITS[0]);
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
      const startBody = (await startRes.json()) as { route: { id: string } };
      const matchesRes = await fetch(
        `/api/routes/${startBody.route.id}/matches`,
      );
      if (!matchesRes.ok) {
        setError("Couldn't load route matches. Please try again.");
        return;
      }
      const matchesBody = (await matchesRes.json()) as { matches: RouteMatch[] };
      setResults(matchesBody.matches);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}

      <Card className="p-5 sm:p-6">
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <MapPin className="h-3.5 w-3.5 text-ash" /> Origin
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="origin-lat">Origin latitude</Label>
                  <Input
                    id="origin-lat"
                    type="number"
                    step="any"
                    value={originLat}
                    onChange={(e) => setOriginLat(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="origin-lng">Origin longitude</Label>
                  <Input
                    id="origin-lng"
                    type="number"
                    step="any"
                    value={originLng}
                    onChange={(e) => setOriginLng(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <MapPin className="h-3.5 w-3.5 text-rust" /> Destination
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dest-lat">Destination latitude</Label>
                  <Input
                    id="dest-lat"
                    type="number"
                    step="any"
                    value={destLat}
                    onChange={(e) => setDestLat(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dest-lng">Destination longitude</Label>
                  <Input
                    id="dest-lng"
                    type="number"
                    step="any"
                    value={destLng}
                    onChange={(e) => setDestLng(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Travel window
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="depart-at">Departing at</Label>
                <Input
                  id="depart-at"
                  type="datetime-local"
                  value={departAt}
                  onChange={(e) => setDepartAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="arrive-by">Arriving by</Label>
                <Input
                  id="arrive-by"
                  type="datetime-local"
                  value={arriveByAt}
                  onChange={(e) => setArriveByAt(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className="max-w-xs">
            <Label htmlFor="max-detour">Maximum detour (km)</Label>
            <Input
              id="max-detour"
              type="number"
              min="0.1"
              step="any"
              value={maxDetourKm}
              onChange={(e) => setMaxDetourKm(e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Materials you will accept
            </legend>
            <p className="mb-3 text-xs text-ash">
              Leave all unchecked to accept any material.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MATERIAL_CATEGORIES.map((m) => {
                const checked = materials.has(m);
                return (
                  <label
                    key={m}
                    className={
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition " +
                      (checked
                        ? "border-moss/50 bg-moss-soft text-ink"
                        : "border-dune bg-paper hover:border-ink/30 hover:bg-sand/50")
                    }
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleMaterial(m)}
                    />
                    <span>{MATERIAL_LABELS[m]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Minimum quantity (optional)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="min-quantity">At least</Label>
                <Input
                  id="min-quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="min-quantity-unit">Unit</Label>
                <Select
                  id="min-quantity-unit"
                  value={minQuantityUnit}
                  onChange={(e) => setMinQuantityUnit(e.target.value)}
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {QUANTITY_UNIT_LABELS[u]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </fieldset>

          <div>
            <Button type="submit" disabled={busy} variant="primary" size="lg">
              <RouteIcon className="h-4 w-4" />
              {busy ? "Finding matches…" : "Start route and find matches"}
            </Button>
          </div>
        </form>
      </Card>

      {results !== null && (
        <section aria-label="Route matches" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl tracking-tight">
              {results.length === 0
                ? "No listings match this route."
                : `${results.length} listing${results.length === 1 ? "" : "s"} along your route`}
            </h2>
            {results.length > 0 && (
              <p className="font-mono text-xs text-ash">
                Tap once parked
              </p>
            )}
          </div>
          {results.length === 0 ? (
            <Card className="border-dashed p-5 text-sm text-ash">
              Try widening your maximum detour or clearing material filters.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {results.map((r) => (
                <li key={r.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="font-serif text-xl tracking-tight text-ink">
                        {r.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 font-mono text-sm text-moss">
                        <Compass className="h-3.5 w-3.5" />+
                        {r.detourKm.toFixed(1)} km detour
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ash">
                      <span className="text-ink">
                        {MATERIAL_LABELS[r.materialCategory]}
                      </span>{" "}
                      · {r.quantityMin}–{r.quantityMax}{" "}
                      {QUANTITY_UNIT_LABELS[r.quantityUnit]} · {r.locality} ·{" "}
                      {AVAILABILITY_LABELS[r.availability]}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(() => {
                        const state = interests[r.id] ?? "idle";
                        if (state === "done") {
                          return (
                            <Button
                              type="button"
                              onClick={() => toggleInterest(r.id)}
                              variant="secondary"
                              size="sm"
                            >
                              <Heart className="h-3.5 w-3.5 fill-rust text-rust" />
                              Withdraw interest
                            </Button>
                          );
                        }
                        return (
                          <Button
                            type="button"
                            onClick={() => toggleInterest(r.id)}
                            disabled={state === "sending"}
                            variant="primary"
                            size="sm"
                          >
                            <Heart className="h-3.5 w-3.5" />
                            {state === "sending"
                              ? "Sending…"
                              : state === "error"
                                ? "Try again"
                                : "I'm interested"}
                          </Button>
                        );
                      })()}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
