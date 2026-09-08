"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_OPTIONS,
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  PROHIBITED_MATERIALS,
  PROHIBITED_NOTICE,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
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
  photos: string; // one URL per line
  quantityMin: string;
  quantityMax: string;
  quantityUnit: string;
  locality: string;
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
        setError(
          res.status === 400
            ? "Please check the highlighted fields and try again."
            : "Could not save your listing. Please try again.",
        );
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
    <form onSubmit={onSubmit}>
      {error && (
        <p role="alert" style={{ color: "#ff8a80" }}>
          {error}
        </p>
      )}

      <div style={noticeStyle}>
        <strong>{PROHIBITED_NOTICE}</strong>
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
          {PROHIBITED_MATERIALS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <label htmlFor="sellerType">Listing as</label>
      <select
        id="sellerType"
        value={values.sellerType}
        onChange={(e) => set("sellerType", e.target.value)}
        style={inputStyle}
      >
        {sellerTypes.map((type) => (
          <option key={type} value={type}>
            {SELLER_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <label htmlFor="materialCategory">Material category</label>
      <select
        id="materialCategory"
        value={values.materialCategory}
        onChange={(e) => set("materialCategory", e.target.value)}
        style={inputStyle}
      >
        {MATERIAL_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {MATERIAL_LABELS[category]}
          </option>
        ))}
      </select>
      {categoryWarning && (
        <p role="note" style={warningStyle}>
          ⚠ {categoryWarning}
        </p>
      )}

      <label htmlFor="title">Title</label>
      <input
        id="title"
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="e.g. Clean PET bottles, ~6 kg"
        style={inputStyle}
      />

      <label htmlFor="description">Description (optional)</label>
      <textarea
        id="description"
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        rows={3}
        style={inputStyle}
      />

      <label htmlFor="photos">Photo URLs (one per line)</label>
      <textarea
        id="photos"
        value={values.photos}
        onChange={(e) => set("photos", e.target.value)}
        rows={3}
        placeholder="https://…/photo1.jpg"
        style={inputStyle}
      />

      <fieldset style={fieldsetStyle}>
        <legend>Estimated quantity</legend>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="quantityMin">From</label>
            <input
              id="quantityMin"
              type="number"
              min="0"
              step="any"
              value={values.quantityMin}
              onChange={(e) => set("quantityMin", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="quantityMax">To</label>
            <input
              id="quantityMax"
              type="number"
              min="0"
              step="any"
              value={values.quantityMax}
              onChange={(e) => set("quantityMax", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="quantityUnit">Unit</label>
            <select
              id="quantityUnit"
              value={values.quantityUnit}
              onChange={(e) => set("quantityUnit", e.target.value)}
              style={inputStyle}
            >
              {QUANTITY_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {QUANTITY_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <label htmlFor="locality">Approximate locality</label>
      <input
        id="locality"
        value={values.locality}
        onChange={(e) => set("locality", e.target.value)}
        placeholder="e.g. Koramangala, Bengaluru"
        style={inputStyle}
      />

      <label htmlFor="availability">Availability</label>
      <select
        id="availability"
        value={values.availability}
        onChange={(e) => set("availability", e.target.value)}
        style={inputStyle}
      >
        {AVAILABILITY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {AVAILABILITY_LABELS[option]}
          </option>
        ))}
      </select>

      <button type="submit" disabled={busy} style={buttonStyle}>
        {busy
          ? "Saving…"
          : mode === "create"
            ? "Publish listing"
            : "Save changes"}
      </button>
    </form>
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

const buttonStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  borderRadius: 6,
  border: "none",
  background: "#2e7d32",
  color: "#fff",
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #b26a00",
  background: "#2a1e0a",
  color: "#ffcc80",
  borderRadius: 8,
  padding: "0.8rem 1rem",
  margin: "0 0 1.2rem",
  fontSize: "0.9rem",
};

const warningStyle: React.CSSProperties = {
  color: "#ffcc80",
  margin: "-0.6rem 0 1rem",
  fontSize: "0.9rem",
};

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "0.6rem 1rem 0",
  margin: "0 0 1rem",
};
