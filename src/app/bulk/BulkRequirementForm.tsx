"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

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
    <Card className="p-5 sm:p-6">
      <form onSubmit={onSubmit} className="grid gap-4">
        {error ? <InlineNote tone="err">{error}</InlineNote> : null}

        <div>
          <Label htmlFor="bulk-material">Material</Label>
          <Select
            id="bulk-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value as MaterialCategory)}
            className="max-w-xs"
          >
            {MATERIAL_CATEGORIES.map((m) => (
              <option key={m} value={m}>
                {MATERIAL_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            Minimum quantity you need
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bulk-min-qty">At least</Label>
              <Input
                id="bulk-min-qty"
                type="number"
                min="0"
                step="any"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bulk-min-qty-unit">Unit</Label>
              <Select
                id="bulk-min-qty-unit"
                value={minQuantityUnit}
                onChange={(e) =>
                  setMinQuantityUnit(e.target.value as QuantityUnit)
                }
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
          <Label htmlFor="bulk-region">Region (service area)</Label>
          <Input
            id="bulk-region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            maxLength={120}
            placeholder="e.g. Bengaluru South"
          />
        </div>

        <div>
          <Label htmlFor="bulk-quality">Quality notes (optional)</Label>
          <Textarea
            id="bulk-quality"
            value={qualityNotes}
            onChange={(e) => setQualityNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Grade, cleanliness, sorting expectations…"
          />
        </div>

        <div className="max-w-xs">
          <Label htmlFor="bulk-deadline">Deadline (optional)</Label>
          <Input
            id="bulk-deadline"
            type="datetime-local"
            value={deadlineAt}
            onChange={(e) => setDeadlineAt(e.target.value)}
          />
        </div>

        <div>
          <Button type="submit" disabled={busy} variant="primary" size="lg">
            <Send className="h-4 w-4" />
            {busy ? "Publishing…" : "Publish requirement"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
