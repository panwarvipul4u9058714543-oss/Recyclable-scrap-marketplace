import { describe, expect, it } from "vitest";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  MATERIAL_WARNINGS,
  isMaterialCategory,
  warningForCategory,
} from "@/lib/materials";

describe("materials", () => {
  it("has a label and a safety warning for every category", () => {
    for (const category of MATERIAL_CATEGORIES) {
      expect(MATERIAL_LABELS[category]).toBeTruthy();
      expect(MATERIAL_WARNINGS[category]).toBeTruthy();
    }
  });

  it("recognises valid categories and rejects unknown ones", () => {
    expect(isMaterialCategory("PLASTIC")).toBe(true);
    expect(isMaterialCategory("URANIUM")).toBe(false);
  });

  it("returns the category warning, or null for an unknown category", () => {
    expect(warningForCategory("GLASS")).toBe(MATERIAL_WARNINGS.GLASS);
    expect(warningForCategory("URANIUM")).toBeNull();
  });
});
