import { describe, expect, it } from "vitest";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_LABELS,
  MATERIAL_WARNINGS,
  RESTRICTED_CATEGORIES,
  findProhibitedTerm,
  isMaterialCategory,
  isRestrictedCategory,
  restrictedWarningForCategory,
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

describe("restricted categories", () => {
  it("marks EWASTE as restricted and PLASTIC as not", () => {
    expect(isRestrictedCategory("EWASTE")).toBe(true);
    expect(isRestrictedCategory("PLASTIC")).toBe(false);
    expect(isRestrictedCategory("URANIUM")).toBe(false);
  });

  it("returns extra guidance for restricted categories and null otherwise", () => {
    expect(restrictedWarningForCategory("EWASTE")).toMatch(/verif|licenced|licensed|batteries/i);
    expect(restrictedWarningForCategory("PLASTIC")).toBeNull();
    expect(restrictedWarningForCategory("URANIUM")).toBeNull();
  });

  it("every restricted category is also a known material category", () => {
    for (const cat of RESTRICTED_CATEGORIES) {
      expect(isMaterialCategory(cat)).toBe(true);
    }
  });
});

describe("findProhibitedTerm", () => {
  it("returns null when the text mentions nothing prohibited", () => {
    expect(findProhibitedTerm("Bag of clean PET bottles from home")).toBeNull();
    expect(findProhibitedTerm("")).toBeNull();
  });

  it("detects single-word prohibited terms case-insensitively", () => {
    expect(findProhibitedTerm("Old syringes from a clinic")).toMatch(/syringe/i);
    expect(findProhibitedTerm("BIOMEDICAL scraps")).toMatch(/biomedical/i);
    expect(findProhibitedTerm("some asbestos sheets")).toMatch(/asbestos/i);
    expect(findProhibitedTerm("possibly stolen copper wire")).toMatch(/stolen/i);
    expect(findProhibitedTerm("industrial sludge")).toMatch(/sludge/i);
  });

  it("detects multi-word prohibited phrases", () => {
    expect(findProhibitedTerm("A gas cylinder in the yard")).toMatch(/gas cylinder/i);
    expect(findProhibitedTerm("Barrels of unknown liquid")).toMatch(/unknown liquid/i);
    expect(findProhibitedTerm("hospital medical waste")).toMatch(/medical waste/i);
  });

  it("uses word boundaries for single-word terms to avoid false positives", () => {
    // "chemistry" must not match "chemical".
    expect(findProhibitedTerm("chemistry teacher's old books")).toBeNull();
    // "painter" must not match "paint".
    expect(findProhibitedTerm("A painter dropped off cardboard")).toBeNull();
  });
});
