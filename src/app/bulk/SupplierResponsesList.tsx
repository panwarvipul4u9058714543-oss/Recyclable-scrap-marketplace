import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { QUANTITY_UNIT_LABELS, type QuantityUnit } from "@/lib/materials";

interface Row {
  id: string;
  requirementId: string;
  offeredQuantity: number;
  offeredQuantityUnit: QuantityUnit;
  status:
    | "PENDING"
    | "WITHDRAWN"
    | "SELECTED"
    | "CANCELLED"
    | "COMPLETED"
    | "FAILED";
}

const STATUS_TONE: Record<Row["status"], "moss" | "warn" | "neutral"> = {
  PENDING: "warn",
  SELECTED: "moss",
  COMPLETED: "moss",
  FAILED: "warn",
  CANCELLED: "neutral",
  WITHDRAWN: "neutral",
};

export function SupplierResponsesList({ responses }: { responses: Row[] }) {
  return (
    <ul className="grid gap-3">
      {responses.map((r) => (
        <li key={r.id}>
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <strong className="font-serif text-lg tracking-tight text-ink">
                Offered {r.offeredQuantity}{" "}
                {QUANTITY_UNIT_LABELS[r.offeredQuantityUnit]}
              </strong>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={`/bulk/${r.requirementId}`}
                className="text-rust underline-offset-4 hover:underline"
              >
                View requirement
              </Link>
              {(r.status === "SELECTED" ||
                r.status === "COMPLETED" ||
                r.status === "FAILED" ||
                r.status === "CANCELLED") && (
                <>
                  <span className="text-ash">·</span>
                  <Link
                    href={`/bulk/responses/${r.id}`}
                    className="inline-flex items-center gap-1 text-rust underline-offset-4 hover:underline"
                  >
                    Open match
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </>
              )}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
