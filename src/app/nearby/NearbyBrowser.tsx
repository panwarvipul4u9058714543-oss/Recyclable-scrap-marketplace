"use client";

import { useState } from "react";
import { Compass, Flag, Heart, LocateFixed, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Select } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
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
  promoted: { tier: "STANDARD" | "PREMIUM" } | null;
}

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
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  async function reportListing(listingId: string) {
    if (reportedIds.has(listingId)) return;
    const reason = window.prompt(
      "Why are you reporting this listing? (e.g. prohibited material, spam, fraud)",
    );
    if (!reason || reason.trim().length < 2) return;
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "LISTING",
          targetId: listingId,
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        setReportedIds((prev) => {
          const next = new Set(prev);
          next.add(listingId);
          return next;
        });
      }
    } catch {
      // best-effort — the user can retry
    }
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
    <div className="space-y-6">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}

      <Card className="p-5 sm:p-6">
        <form onSubmit={onSubmit} className="grid gap-5">
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium text-ink">
              Search location
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={useMyLocation}
              variant="secondary"
              size="sm"
              className="self-start"
            >
              <LocateFixed className="h-3.5 w-3.5" /> Use my location
            </Button>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="material">Material</Label>
              <Select
                id="material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                <option value={ALL}>Any material</option>
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MATERIAL_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="availability">Availability</Label>
              <Select
                id="availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              >
                <option value={ALL}>Any availability</option>
                {AVAILABILITY_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {AVAILABILITY_LABELS[a]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium text-ink">
              Minimum quantity
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="minQuantity">At least</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="0"
                  step="any"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="quantityUnit">Unit</Label>
                <Select
                  id="quantityUnit"
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
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
            <Label htmlFor="maxDistanceKm">Maximum distance (km)</Label>
            <Input
              id="maxDistanceKm"
              type="number"
              min="0"
              step="any"
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(e.target.value)}
              placeholder="e.g. 10"
              className="max-w-xs"
            />
            <FieldHint>Leave blank to search the full result window.</FieldHint>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={busy} size="lg">
              <Search className="h-4 w-4" />
              {busy ? "Searching…" : "Show nearby listings"}
            </Button>
          </div>
        </form>
      </Card>

      {results !== null && (
        <section
          aria-label="Search results"
          role="region"
          className="animate-fade-in space-y-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl tracking-tight">
              {results.length === 0
                ? "No nearby listings match those filters."
                : `${results.length} nearby listing${results.length === 1 ? "" : "s"}`}
            </h2>
            {results.length > 0 ? (
              <p className="font-mono text-xs text-ash">
                {results.length.toString().padStart(2, "0")} within window
              </p>
            ) : null}
          </div>

          {results.length === 0 ? (
            <Card className="border-dashed p-6 text-sm text-ash">
              Loosen a filter — widen the distance or clear a specific material
              — and search again.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {results.map((r, idx) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03 }}
                >
                  <Card className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="flex flex-wrap items-center gap-2 font-serif text-xl tracking-tight text-ink">
                        {r.title}
                        {r.promoted && (
                          <span>
                            <Badge
                              tone={r.promoted.tier === "PREMIUM" ? "rust" : "moss"}
                            >
                              {r.promoted.tier === "PREMIUM" ? "Featured" : "Promoted"}
                            </Badge>
                          </span>
                        )}
                      </h3>
                      <span className="inline-flex items-center gap-1 font-mono text-sm text-moss">
                        <Compass className="h-3.5 w-3.5" />
                        {r.distanceKm.toFixed(1)} km
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
                      <Button
                        type="button"
                        onClick={() => reportListing(r.id)}
                        variant="ghost"
                        size="sm"
                        disabled={reportedIds.has(r.id)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {reportedIds.has(r.id) ? "Reported" : "Report listing"}
                      </Button>
                    </div>
                  </Card>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
