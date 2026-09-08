import { z } from "zod";

/**
 * The marketplace is for *ordinary recyclable scrap only*. The fixed set of
 * material categories a listing can use lives here, alongside the warnings we
 * surface so people never list hazardous or otherwise non-ordinary material.
 */
export const MATERIAL_CATEGORIES = [
  "PAPER",
  "CARDBOARD",
  "PLASTIC",
  "GLASS",
  "METAL",
  "EWASTE",
  "TEXTILE",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Human-readable labels for each material category, for use in UI. */
export const MATERIAL_LABELS: Record<MaterialCategory, string> = {
  PAPER: "Paper (newspaper, books, office paper)",
  CARDBOARD: "Cardboard & cartons",
  PLASTIC: "Plastic (bottles, containers, packaging)",
  GLASS: "Glass bottles & jars",
  METAL: "Metal (tins, utensils, wire, sheet)",
  EWASTE: "E-waste (appliances, gadgets, cables)",
  TEXTILE: "Textiles (clothes, fabric, rags)",
};

/**
 * Per-category safety guidance. Every ordinary recyclable still has an "only
 * list it if…" caveat, shown on the listing form once a category is chosen.
 */
export const MATERIAL_WARNINGS: Record<MaterialCategory, string> = {
  PAPER: "Keep it dry and free of food waste. No laminated or waxed paper.",
  CARDBOARD: "Flatten boxes and remove tape, thermocol and packing foam.",
  PLASTIC: "Rinse containers. No PVC pipes, syringes or single-use medical plastic.",
  GLASS: "Bottles and jars only — no bulbs, tube-lights, mirrors or broken sheet glass.",
  METAL: "Household and industrial metal only — never gas cylinders or aerosol cans.",
  EWASTE:
    "Remove and set aside all batteries. No CRT monitors, and never break open screens.",
  TEXTILE: "Clean, dry fabric only. No oil-soaked or chemically contaminated cloth.",
};

/**
 * Material that is NOT ordinary recyclable scrap and must never be listed.
 * Surfaced as a prominent warning on the create/edit form.
 */
export const PROHIBITED_MATERIALS: readonly string[] = [
  "Medical or biohazard waste (syringes, expired medicines, sanitary waste)",
  "Chemicals, solvents, paints, pesticides and their containers",
  "Gas cylinders, aerosol cans and other pressurised containers",
  "Batteries in bulk, and anything radioactive or explosive",
  "Asbestos, construction debris and general household garbage",
];

/**
 * The single-line notice shown above the material picker to make the
 * "ordinary recyclable scrap only" rule unmissable.
 */
export const PROHIBITED_NOTICE =
  "List ordinary recyclable scrap only. Hazardous, medical and prohibited items are not allowed.";

export const QUANTITY_UNITS = ["KG", "PIECES", "BAGS", "TONNES"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  KG: "kg",
  PIECES: "pieces",
  BAGS: "bags",
  TONNES: "tonnes",
};

export const AVAILABILITY_OPTIONS = [
  "ANYTIME",
  "WEEKDAYS",
  "WEEKENDS",
  "BY_APPOINTMENT",
] as const;
export type Availability = (typeof AVAILABILITY_OPTIONS)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  ANYTIME: "Anytime",
  WEEKDAYS: "Weekdays",
  WEEKENDS: "Weekends",
  BY_APPOINTMENT: "By appointment",
};

export const materialCategorySchema = z.enum(MATERIAL_CATEGORIES);
export const quantityUnitSchema = z.enum(QUANTITY_UNITS);
export const availabilitySchema = z.enum(AVAILABILITY_OPTIONS);

export function isMaterialCategory(value: string): value is MaterialCategory {
  return (MATERIAL_CATEGORIES as readonly string[]).includes(value);
}

/** The safety warning for a category, or null when the category is unknown. */
export function warningForCategory(value: string): string | null {
  return isMaterialCategory(value) ? MATERIAL_WARNINGS[value] : null;
}
