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
      const body = (await res.json()) as { response: { id: string } };
      setOkResponseId(body.response.id);
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
        {okResponseId ? (
          <InlineNote tone="ok">
            Response submitted. The buyer will see it on their requirement.
          </InlineNote>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            What you can supply
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="offer-qty">Quantity</Label>
              <Input
                id="offer-qty"
                type="number"
                min="0"
                step="any"
                value={offeredQuantity}
                onChange={(e) => setOfferedQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="offer-unit">Unit</Label>
              <Select
                id="offer-unit"
                value={offeredQuantityUnit}
                onChange={(e) =>
                  setOfferedQuantityUnit(e.target.value as QuantityUnit)
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
          <Label htmlFor="offer-notes">Notes (optional)</Label>
          <Textarea
            id="offer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Grade, cadence, pickup arrangements…"
          />
        </div>

        <div>
          <Button type="submit" disabled={busy} variant="primary" size="lg">
            <Send className="h-4 w-4" />
            {busy ? "Submitting…" : "Submit response"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
