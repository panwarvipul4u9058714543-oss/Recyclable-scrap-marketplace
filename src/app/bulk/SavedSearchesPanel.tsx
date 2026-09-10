"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
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
    if (
      !confirm(
        "Delete this saved search? Alerts you already received will stay.",
      )
    ) {
      return;
    }
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section aria-label="Saved searches" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">
            Saved searches &amp; alerts
          </h2>
          <p className="mt-1 text-sm text-ash">
            Save a supply query and receive an alert whenever a new listing
            matches. Toggle alerts off to pause a search without deleting it.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          variant={showForm ? "ghost" : "secondary"}
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" />
          {showForm ? "Cancel" : "+ New saved search"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5 sm:p-6">
          <form onSubmit={create} className="grid gap-4">
            {error ? <InlineNote tone="err">{error}</InlineNote> : null}
            <div>
              <Label htmlFor="ss-name">Name</Label>
              <Input
                id="ss-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="ss-material">Material (optional)</Label>
              <Select
                id="ss-material"
                value={material}
                onChange={(e) =>
                  setMaterial(e.target.value as MaterialCategory | "")
                }
                className="max-w-xs"
              >
                <option value="">Any</option>
                {MATERIAL_CATEGORIES.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ss-min-qty">
                  Min supplier quantity (optional)
                </Label>
                <Input
                  id="ss-min-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={supplyQty}
                  onChange={(e) => setSupplyQty(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ss-min-unit">Unit</Label>
                <Select
                  id="ss-min-unit"
                  value={supplyUnit}
                  onChange={(e) => setSupplyUnit(e.target.value as QuantityUnit)}
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {QUANTITY_UNIT_LABELS[u]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="ss-region">Region contains (optional)</Label>
              <Input
                id="ss-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Bengaluru"
                maxLength={120}
              />
            </div>
            <div>
              <Button type="submit" disabled={busy} variant="primary">
                <Save className="h-4 w-4" />
                {busy ? "Saving…" : "Save search"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {searches.length === 0 ? (
        <Card className="border-dashed p-5 text-sm text-ash">
          You haven&apos;t saved any searches yet.
        </Card>
      ) : (
        <ul className="grid gap-3">
          {searches.map((s) => (
            <li key={s.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong className="font-serif text-lg tracking-tight text-ink">
                    {s.name}
                  </strong>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <Checkbox
                      checked={s.alertsEnabled}
                      onChange={(e) => toggleAlerts(s.id, e.target.checked)}
                    />
                    <span>Alerts on</span>
                  </label>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ash">
                  <Badge tone={s.material ? "moss" : "neutral"}>
                    {s.material ? MATERIAL_LABELS[s.material] : "Any material"}
                  </Badge>
                  <span>·</span>
                  <span>
                    {s.supplyMinQuantity && s.supplyMinQuantityUnit
                      ? `≥ ${s.supplyMinQuantity} ${QUANTITY_UNIT_LABELS[s.supplyMinQuantityUnit]}`
                      : "Any quantity"}
                  </span>
                  {s.region && (
                    <>
                      <span>·</span>
                      <span>region contains {s.region}</span>
                    </>
                  )}
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={() => remove(s.id)}
                    variant="ghost"
                    size="sm"
                    className="text-signal-err hover:bg-signal-err/10 hover:text-signal-err"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
