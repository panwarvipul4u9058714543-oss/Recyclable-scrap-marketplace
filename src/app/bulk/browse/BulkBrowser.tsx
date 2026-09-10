"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, BadgeCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  async function fetchResults(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const params = new URLSearchParams({ scope: "browse" });
      if (material) params.set("material", material);
      if (supplyQuantity.trim() !== "") {
        const n = Number(supplyQuantity);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Supply quantity must be a positive number.");
          setBusy(false);
          return;
        }
        params.set("supplyQuantity", String(n));
        params.set("supplyQuantityUnit", supplyQuantityUnit);
      }
      if (region.trim() !== "") params.set("region", region.trim());
      if (buyerRole) params.set("buyerRole", buyerRole);

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

  useEffect(() => {
    void fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}

      <Card className="p-5 sm:p-6">
        <form onSubmit={fetchResults} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="browse-material">Material</Label>
              <Select
                id="browse-material"
                value={material}
                onChange={(e) =>
                  setMaterial(e.target.value as MaterialCategory | "")
                }
              >
                <option value="">Any</option>
                {MATERIAL_CATEGORIES.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="browse-buyer-role">Buyer type</Label>
              <Select
                id="browse-buyer-role"
                value={buyerRole}
                onChange={(e) => setBuyerRole(e.target.value as Role | "")}
              >
                <option value="">Any</option>
                {BULK_BUYER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="browse-region">Region contains</Label>
              <Input
                id="browse-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Bengaluru"
              />
            </div>
            <div>
              <Label htmlFor="browse-supply-qty">I can supply</Label>
              <Input
                id="browse-supply-qty"
                type="number"
                min="0"
                step="any"
                value={supplyQuantity}
                onChange={(e) => setSupplyQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="browse-supply-unit">Unit</Label>
              <Select
                id="browse-supply-unit"
                value={supplyQuantityUnit}
                onChange={(e) =>
                  setSupplyQuantityUnit(e.target.value as QuantityUnit)
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
          <div>
            <Button type="submit" disabled={busy} variant="primary" size="lg">
              <Search className="h-4 w-4" />
              {busy ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
      </Card>

      {results !== null && (
        <section aria-label="Bulk requirements" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl tracking-tight">
              {results.length === 0
                ? "No requirements match your filters."
                : `${results.length} bulk requirement${results.length === 1 ? "" : "s"}`}
            </h2>
            {results.length > 0 ? (
              <p className="font-mono text-xs text-ash">
                {results.length.toString().padStart(2, "0")} listed
              </p>
            ) : null}
          </div>
          {results.length === 0 ? (
            <Card className="border-dashed p-5 text-sm text-ash">
              Widen the region or clear a material filter and search again.
            </Card>
          ) : (
            <ul className="grid gap-3">
              {results.map((r) => (
                <li key={r.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="font-serif text-xl tracking-tight text-ink">
                        {MATERIAL_LABELS[r.material]}
                      </h3>
                      <span className="inline-flex items-center gap-1 font-mono text-sm text-moss">
                        Wants ≥ {r.minQuantity}{" "}
                        {QUANTITY_UNIT_LABELS[r.minQuantityUnit]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ash">
                      {r.region}
                      {r.deadlineAt && (
                        <>
                          {" "}
                          · deadline{" "}
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

                    <div className="mt-4 rounded-md border border-dune bg-sand/50 p-3">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-moss" />
                        <strong className="font-medium text-ink">
                          {r.buyer.organisationName ??
                            r.buyer.displayName ??
                            "Buyer"}
                        </strong>
                        <span className="text-xs text-ash">
                          ·{" "}
                          {r.buyer.roles
                            .filter((role) =>
                              (BULK_BUYER_ROLES as readonly Role[]).includes(
                                role,
                              ),
                            )
                            .map((role) => ROLE_LABELS[role])
                            .join(", ") || "Buyer"}
                        </span>
                      </div>
                      {r.buyer.registrationId && (
                        <p className="mt-1 text-xs text-ash">
                          Registration:{" "}
                          <code className="font-mono text-ink">
                            {r.buyer.registrationId}
                          </code>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ash">
                        Completed as buyer:{" "}
                        <span className="font-mono text-ink">
                          {r.buyer.reputation.completedAsCollector}
                        </span>{" "}
                        · Failed:{" "}
                        <span className="font-mono text-ink">
                          {r.buyer.reputation.failed}
                        </span>
                        {r.buyer.reputation.rating.count > 0 && (
                          <>
                            {" "}
                            · Rating{" "}
                            <span className="font-mono text-ink">
                              {r.buyer.reputation.rating.average?.toFixed(1)}
                            </span>{" "}
                            ({r.buyer.reputation.rating.count})
                          </>
                        )}
                      </p>
                      <Link
                        href={`/u/${r.buyer.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-rust underline-offset-4 hover:underline"
                      >
                        View buyer profile
                      </Link>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/bulk/${r.id}`}
                        className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-rust hover:underline"
                      >
                        Open requirement → respond
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
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
