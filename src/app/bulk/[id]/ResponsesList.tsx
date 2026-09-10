"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { QUANTITY_UNIT_LABELS, type QuantityUnit } from "@/lib/materials";

interface ResponseRow {
  id: string;
  offeredQuantity: number;
  offeredQuantityUnit: QuantityUnit;
  notes: string | null;
  status:
    | "PENDING"
    | "WITHDRAWN"
    | "SELECTED"
    | "CANCELLED"
    | "COMPLETED"
    | "FAILED";
  createdAt: string;
}

const STATUS_TONE: Record<ResponseRow["status"], "moss" | "warn" | "neutral"> = {
  PENDING: "warn",
  SELECTED: "moss",
  COMPLETED: "moss",
  FAILED: "warn",
  CANCELLED: "neutral",
  WITHDRAWN: "neutral",
};

export function ResponsesList({ responses }: { responses: ResponseRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const hasSelected = responses.some((r) => r.status === "SELECTED");

  async function select(id: string) {
    setBusy((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/bulk-responses/${id}/select`, {
        method: "POST",
      });
      if (!res.ok) {
        if (res.status === 409) {
          setError("Another response is already selected on this requirement.");
        } else {
          setError("Couldn't select this response. Please try again.");
        }
        return;
      }
      router.refresh();
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-3">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}
      <ul className="grid gap-3">
        {responses.map((r) => (
          <li key={r.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <strong className="font-serif text-lg tracking-tight text-ink">
                  Offers {r.offeredQuantity}{" "}
                  {QUANTITY_UNIT_LABELS[r.offeredQuantityUnit]}
                </strong>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>
              {r.notes && (
                <p className="mt-2 text-sm leading-snug text-ink/85">
                  {r.notes}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "PENDING" && !hasSelected && (
                  <Button
                    type="button"
                    onClick={() => select(r.id)}
                    disabled={busy[r.id]}
                    variant="primary"
                    size="sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {busy[r.id] ? "Selecting…" : "Select this supplier"}
                  </Button>
                )}
                {(r.status === "SELECTED" ||
                  r.status === "COMPLETED" ||
                  r.status === "FAILED" ||
                  r.status === "CANCELLED") && (
                  <Link
                    href={`/bulk/responses/${r.id}`}
                    className="focus-ring inline-flex"
                  >
                    <Button type="button" variant="secondary" size="sm">
                      Open response
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
