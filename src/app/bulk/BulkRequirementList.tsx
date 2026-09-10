"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";

interface RequirementRow {
  id: string;
  material: MaterialCategory;
  minQuantity: number;
  minQuantityUnit: QuantityUnit;
  region: string;
  qualityNotes: string | null;
  deadlineAt: string | null;
  status: "ACTIVE" | "CLOSED";
}

export function BulkRequirementList({
  requirements,
}: {
  requirements: RequirementRow[];
}) {
  const router = useRouter();
  const [closing, setClosing] = useState<Record<string, boolean>>({});

  async function close(id: string) {
    setClosing((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/bulk-requirements/${id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setClosing((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <ul className="grid gap-3">
      {requirements.map((r) => (
        <li key={r.id}>
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-serif text-xl tracking-tight text-ink">
                {MATERIAL_LABELS[r.material]}
              </h3>
              <Badge tone={r.status === "ACTIVE" ? "moss" : "neutral"}>
                {r.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ash">
              At least{" "}
              <span className="text-ink">
                {r.minQuantity} {QUANTITY_UNIT_LABELS[r.minQuantityUnit]}
              </span>{" "}
              · {r.region}
              {r.deadlineAt && (
                <>
                  {" "}
                  · by{" "}
                  <time dateTime={r.deadlineAt} className="text-ink">
                    {new Date(r.deadlineAt).toLocaleDateString()}
                  </time>
                </>
              )}
            </p>
            {r.qualityNotes && (
              <p className="mt-2 text-sm leading-snug text-ink/85">
                {r.qualityNotes}
              </p>
            )}
            {r.status === "ACTIVE" && (
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={() => close(r.id)}
                  disabled={closing[r.id]}
                  variant="ghost"
                  size="sm"
                  className="text-signal-err hover:bg-signal-err/10 hover:text-signal-err"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {closing[r.id] ? "Closing…" : "Close requirement"}
                </Button>
              </div>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
