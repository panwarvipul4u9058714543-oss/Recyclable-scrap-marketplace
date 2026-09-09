"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  type MaterialCategory,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type QuantityUnit,
} from "@/lib/materials";
import { BULK_BUYER_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

interface BuyerBadge {
  id: string;
  displayName: string | null;
  organisationName: string | null;
  registrationId: string | null;
  roles: Role[];
  reputation: {
    completedAsSeller: number;
    completedAsCollector: number;
    cancelledOrExpired: number;
    failed: number;
    rating: { average: number | null; count: number };
  };
}

interface Requirement {
  id: string;
  material: MaterialCategory;
  minQuantity: number;
  minQuantityUnit: QuantityUnit;
  qualityNotes: string | null;
  region: string;
  deadlineAt: string | null;
  buyer: BuyerBadge;
}

export function BulkBrowser() {
  const [material, setMaterial] = useState<MaterialCategory | "">("");
  const [supplyQuantity, setSupplyQuantity] = useState("");
  const [supplyQuantityUnit, setSupplyQuantityUnit] = useState<QuantityUnit>(
    QUANTITY_UNITS[0],
  );
  const [region, setRegion] = useState("");
  const [buyerRole, setBuyerRole] = useState<Role | "">("");
  const [results, setResults] = useState<Requirement[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchResults(
    e?: React.FormEvent,
    filters?: {
      material?: MaterialCategory | "";
      supplyQuantity?: string;
      supplyQuantityUnit?: QuantityUnit;
      region?: string;
      buyerRole?: Role | "";
    },
  ) {
    if (e) e.preventDefault();
    const eff = {
      material: filters?.material ?? material,
      supplyQuantity: filters?.supplyQuantity ?? supplyQuantity,
      supplyQuantityUnit: filters?.supplyQuantityUnit ?? supplyQuantityUnit,
      region: filters?.region ?? region,
      buyerRole: filters?.buyerRole ?? buyerRole,
    };
    setError(null);
    setBusy(true);
    try {
      const params = new URLSearchParams({ scope: "browse" });
      if (eff.material) params.set("material", eff.material);
      if (eff.supplyQuantity.trim() !== "") {
        const n = Number(eff.supplyQuantity);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Supply quantity must be a positive number.");
          setBusy(false);
          return;
        }
        params.set("supplyQuantity", String(n));
        params.set("supplyQuantityUnit", eff.supplyQuantityUnit);
      }
      if (eff.region.trim() !== "") params.set("region", eff.region.trim());
      if (eff.buyerRole) params.set("buyerRole", eff.buyerRole);

      const res = await fetch(`/api/bulk-requirements?${params.toString()}`);
      if (!res.ok) {
        setError("Couldn't load requirements. Please try again.");
        return;
      }
      const body = (await res.json()) as { requirements: Requirement[] };
      setResults(body.requirements);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Initial load — an empty search returns all open requirements.
  useEffect(() => {
    void fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <form onSubmit={(e) => fetchResults(e)}>
        {error && (
          <p role="alert" style={{ color: "#ff8a80" }}>
            {error}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.6rem",
          }}
        >
          <div>
            <label htmlFor="browse-material">Material</label>
            <select
              id="browse-material"
              value={material}
              onChange={(e) =>
                setMaterial(e.target.value as MaterialCategory | "")
              }
              style={inputStyle}
            >
              <option value="">Any</option>
              {MATERIAL_CATEGORIES.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="browse-buyer-role">Buyer type</label>
            <select
              id="browse-buyer-role"
              value={buyerRole}
              onChange={(e) => setBuyerRole(e.target.value as Role | "")}
              style={inputStyle}
            >
              <option value="">Any</option>
              {BULK_BUYER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="browse-region">Region contains</label>
            <input
              id="browse-region"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Bengaluru"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="browse-supply-qty">I can supply</label>
            <input
              id="browse-supply-qty"
              type="number"
              min="0"
              step="any"
              value={supplyQuantity}
              onChange={(e) => setSupplyQuantity(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="browse-supply-unit">Unit</label>
            <select
              id="browse-supply-unit"
              value={supplyQuantityUnit}
              onChange={(e) =>
                setSupplyQuantityUnit(e.target.value as QuantityUnit)
              }
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
        <button type="submit" disabled={busy} style={primaryButtonStyle}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {results !== null && (
        <section
          aria-label="Bulk requirements"
          style={{ marginTop: "1.5rem" }}
        >
          <h2 style={{ fontSize: "1.1rem" }}>
            {results.length === 0
              ? "No requirements match your filters."
              : `${results.length} bulk requirement${results.length === 1 ? "" : "s"}`}
          </h2>
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
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>
                    {MATERIAL_LABELS[r.material]}
                  </h3>
                  <span style={{ fontSize: "0.85rem", color: "#81c784" }}>
                    Wants ≥ {r.minQuantity}{" "}
                    {QUANTITY_UNIT_LABELS[r.minQuantityUnit]}
                  </span>
                </div>
                <p style={metaStyle}>
                  {r.region}
                  {r.deadlineAt && (
                    <>
                      {" "}
                      · deadline{" "}
                      <time dateTime={r.deadlineAt}>
                        {new Date(r.deadlineAt).toLocaleDateString()}
                      </time>
                    </>
                  )}
                </p>
                {r.qualityNotes && (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
                    {r.qualityNotes}
                  </p>
                )}
                <div style={buyerBadgeStyle}>
                  <div>
                    <strong>
                      {r.buyer.organisationName ??
                        r.buyer.displayName ??
                        "Buyer"}
                    </strong>{" "}
                    <span style={{ color: "#9e9e9e", fontSize: "0.85rem" }}>
                      ·{" "}
                      {r.buyer.roles
                        .filter((role) =>
                          (BULK_BUYER_ROLES as readonly Role[]).includes(role),
                        )
                        .map((role) => ROLE_LABELS[role])
                        .join(", ") || "Buyer"}
                    </span>
                  </div>
                  {r.buyer.registrationId && (
                    <div style={{ fontSize: "0.85rem", color: "#9e9e9e" }}>
                      Registration:{" "}
                      <code>{r.buyer.registrationId}</code>
                    </div>
                  )}
                  <div style={{ fontSize: "0.85rem", color: "#9e9e9e" }}>
                    Completed as buyer:{" "}
                    {r.buyer.reputation.completedAsCollector} · Failed:{" "}
                    {r.buyer.reputation.failed}
                    {r.buyer.reputation.rating.count > 0 && (
                      <>
                        {" "}
                        · Rating{" "}
                        {r.buyer.reputation.rating.average?.toFixed(1)} (
                        {r.buyer.reputation.rating.count})
                      </>
                    )}
                  </div>
                  <Link
                    href={`/u/${r.buyer.id}`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    View buyer profile
                  </Link>
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

const buyerBadgeStyle: React.CSSProperties = {
  marginTop: "0.7rem",
  padding: "0.6rem 0.8rem",
  borderRadius: 6,
  background: "#141821",
  border: "1px solid #2a2f3a",
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
};
