"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineNote } from "@/components/ui/inline-note";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  PROHIBITED_MATERIALS,
  PROHIBITED_NOTICE,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  restrictedWarningForCategory,
  warningForCategory,
} from "@/lib/materials";
import type { SellerType } from "@/lib/listings/listings";
import { SELLER_TYPES } from "@/lib/listings/listings";

const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  HOUSEHOLD: "Household",
  BUSINESS: "Business",
};

export interface ListingFormValues {
  sellerType: string;
  materialCategory: string;
  title: string;
  description: string;
  photos: string;
  quantityMin: string;
  quantityMax: string;
  quantityUnit: string;
  locality: string;
  latitude: string;
  longitude: string;
  availability: string;
}

interface ListingFormProps {
  mode: "create" | "edit";
  sellerTypes: SellerType[];
  listingId?: string;
  initial?: Partial<ListingFormValues>;
}

function defaults(sellerTypes: SellerType[]): ListingFormValues {
  return {
    sellerType: sellerTypes[0] ?? SELLER_TYPES[0],
    materialCategory: MATERIAL_CATEGORIES[0],
    title: "",
    description: "",
    photos: "",
    quantityMin: "",
    quantityMax: "",
    quantityUnit: QUANTITY_UNITS[0],
    locality: "",
    latitude: "",
    longitude: "",
    availability: AVAILABILITY_OPTIONS[0],
  };
}

export function ListingForm({
  mode,
  sellerTypes,
  listingId,
  initial,
}: ListingFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ListingFormValues>({
    ...defaults(sellerTypes),
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categoryWarning = useMemo(
    () => warningForCategory(values.materialCategory),
    [values.materialCategory],
  );
  const restrictedNotice = useMemo(
    () => restrictedWarningForCategory(values.materialCategory),
    [values.materialCategory],
  );

  function set<K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const photos = values.photos
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (photos.length === 0) {
      setError("Add at least one photo URL (one per line).");
      return;
    }

    if (values.quantityMin.trim() === "" || values.quantityMax.trim() === "") {
      setError("Enter a quantity range.");
      return;
    }
    const quantityMin = Number(values.quantityMin);
    const quantityMax = Number(values.quantityMax);
    if (
      !Number.isFinite(quantityMin) ||
      !Number.isFinite(quantityMax) ||
      quantityMin <= 0 ||
      quantityMax <= 0
    ) {
      setError("Enter a positive quantity range.");
      return;
    }
    if (quantityMax < quantityMin) {
      setError("Maximum quantity must be at least the minimum.");
      return;
    }

    if (values.latitude.trim() === "" || values.longitude.trim() === "") {
      setError("Enter the pickup location (latitude and longitude).");
      return;
    }
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError(
        "Latitude must be between -90 and 90, longitude between -180 and 180.",
      );
      return;
    }

    const payload = {
      sellerType: values.sellerType,
      materialCategory: values.materialCategory,
      title: values.title,
      description: values.description,
      photos,
      quantityMin,
      quantityMax,
      quantityUnit: values.quantityUnit,
      locality: values.locality,
      latitude,
      longitude,
      availability: values.availability,
    };

    setBusy(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/listings", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/listings/${listingId}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (res.status === 422 && body?.error === "prohibited_content") {
          setError(
            "This listing looks like it names a prohibited material. Please remove hazardous, medical or other prohibited items and try again.",
          );
        } else if (res.status === 400) {
          setError("Please check the highlighted fields and try again.");
        } else {
          setError("Could not save your listing. Please try again.");
        }
        return;
      }
      router.push("/listings");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? <InlineNote tone="err">{error}</InlineNote> : null}

      {/* Retain PROHIBITED_NOTICE verbatim so the e2e "List ordinary
       * recyclable scrap only" assertion resolves. */}
      <Card className="border-signal-warn/40 bg-signal-warn/5 p-5">
        <p className="flex items-start gap-2 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-warn" />
          <strong className="font-medium">{PROHIBITED_NOTICE}</strong>
        </p>
        <ul className="mt-3 grid gap-1 pl-6 text-xs text-ash sm:grid-cols-2">
          {PROHIBITED_MATERIALS.map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl tracking-tight">The basics</h2>
          <p className="mt-1 text-sm text-ash">
            What you&apos;re listing, and who&apos;s posting it.
          </p>
        </div>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="sellerType">Listing as</Label>
            <Select
              id="sellerType"
              value={values.sellerType}
              onChange={(e) => set("sellerType", e.target.value)}
              className="max-w-xs"
            >
              {sellerTypes.map((type) => (
                <option key={type} value={type}>
                  {SELLER_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="materialCategory">Material category</Label>
            <Select
              id="materialCategory"
              value={values.materialCategory}
              onChange={(e) => set("materialCategory", e.target.value)}
              className="max-w-xs"
            >
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {MATERIAL_LABELS[category]}
                </option>
              ))}
            </Select>
            {categoryWarning && (
              <p
                role="note"
                className="mt-2 flex items-start gap-2 rounded-md border border-signal-warn/30 bg-signal-warn/10 px-3 py-2 text-xs text-signal-warn"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {categoryWarning}
              </p>
            )}
            {restrictedNotice && (
              <p
                role="note"
                className="mt-2 flex items-start gap-2 rounded-md border border-signal-warn/30 bg-signal-warn/10 px-3 py-2 text-xs text-signal-warn"
              >
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="font-medium">Extra verification may be required.</strong>{" "}
                  {restrictedNotice}
                </span>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Clean PET bottles, ~6 kg"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="photos">Photo URLs (one per line)</Label>
            <Textarea
              id="photos"
              value={values.photos}
              onChange={(e) => set("photos", e.target.value)}
              rows={3}
              placeholder="https://…/photo1.jpg"
              className="font-mono text-xs"
            />
            <FieldHint>At least one URL required.</FieldHint>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl tracking-tight">
            Quantity &amp; availability
          </h2>
          <p className="mt-1 text-sm text-ash">
            Give a range — buyers plan the run around it.
          </p>
        </div>
        <div className="grid gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Estimated quantity
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="quantityMin">From</Label>
                <Input
                  id="quantityMin"
                  type="number"
                  min="0"
                  step="any"
                  value={values.quantityMin}
                  onChange={(e) => set("quantityMin", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="quantityMax">To</Label>
                <Input
                  id="quantityMax"
                  type="number"
                  min="0"
                  step="any"
                  value={values.quantityMax}
                  onChange={(e) => set("quantityMax", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="quantityUnit">Unit</Label>
                <Select
                  id="quantityUnit"
                  value={values.quantityUnit}
                  onChange={(e) => set("quantityUnit", e.target.value)}
                >
                  {QUANTITY_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {QUANTITY_UNIT_LABELS[unit]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="availability">Availability</Label>
            <Select
              id="availability"
              value={values.availability}
              onChange={(e) => set("availability", e.target.value)}
              className="max-w-xs"
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {AVAILABILITY_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl tracking-tight">Pickup location</h2>
          <p className="mt-1 text-sm text-ash">
            The nearby buyer sees a locality string; distance is computed from
            the exact coordinates below.
          </p>
        </div>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="locality">Approximate locality</Label>
            <Input
              id="locality"
              value={values.locality}
              onChange={(e) => set("locality", e.target.value)}
              placeholder="e.g. Koramangala, Bengaluru"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Pickup coordinates
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={values.latitude}
                  onChange={(e) => set("latitude", e.target.value)}
                  placeholder="12.9352"
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={values.longitude}
                  onChange={(e) => set("longitude", e.target.value)}
                  placeholder="77.6245"
                />
              </div>
            </div>
          </fieldset>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} variant="primary" size="lg">
          {busy
            ? "Saving…"
            : mode === "create"
              ? "Publish listing"
              : "Save changes"}
        </Button>
        <span className="text-xs text-ash">
          {mode === "create"
            ? "You can pause or close it anytime."
            : "Changes take effect immediately."}
        </span>
      </div>
    </form>
  );
}
