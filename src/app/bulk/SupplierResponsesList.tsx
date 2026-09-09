import Link from "next/link";
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

export function SupplierResponsesList({ responses }: { responses: Row[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {responses.map((r) => (
        <li key={r.id} style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "baseline",
            }}
          >
            <strong>
              Offered {r.offeredQuantity}{" "}
              {QUANTITY_UNIT_LABELS[r.offeredQuantityUnit]}
            </strong>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                color:
                  r.status === "SELECTED"
                    ? "#81c784"
                    : r.status === "PENDING"
                      ? "#ffcc80"
                      : "#9e9e9e",
              }}
            >
              {r.status}
            </span>
          </div>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
            <Link href={`/bulk/${r.requirementId}`}>
              View requirement
            </Link>
            {(r.status === "SELECTED" ||
              r.status === "COMPLETED" ||
              r.status === "FAILED" ||
              r.status === "CANCELLED") && (
              <>
                {" · "}
                <Link href={`/bulk/responses/${r.id}`}>Open match</Link>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.9rem 1rem",
  margin: "0.8rem 0",
};
