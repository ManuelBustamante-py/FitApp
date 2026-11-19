import { describe, expect, it } from "vitest";

import {
  categoryEs,
  detectState,
  normalizeFood,
  sourceForDataType,
  validateNutrients,
  type UsdaFood,
} from "./normalize.ts";

describe("sourceForDataType", () => {
  it("Foundation y SR Legacy → usda_fdc; FNDDS → usda_fndds; el resto no se importa", () => {
    expect(sourceForDataType("foundation_food")).toBe("usda_fdc");
    expect(sourceForDataType("sr_legacy_food")).toBe("usda_fdc");
    expect(sourceForDataType("survey_fndds_food")).toBe("usda_fndds");
    expect(sourceForDataType("sample_food")).toBeNull();
    expect(sourceForDataType("branded_food")).toBeNull();
  });
});

describe("detectState", () => {
  it.each([
    ["Broccoli, raw", "crudo"],
    ["Pasta, dry, uncooked", "crudo"],
    ["Rice, white, cooked", "cocido"],
    ["Carrots, cooked, from raw", "cocido"],
    ["Chicken, roasted", "cocido"],
    ["Cookies, chocolate chip", "na"],
    ["Milk, whole", "na"],
  ] as const)("%s → %s", (name, state) => {
    expect(detectState(name)).toBe(state);
  });
});

describe("categoryEs", () => {
  it("traduce las categorías de FDC y deja las demás como vienen", () => {
    expect(categoryEs("Poultry Products")).toBe("Aves");
    expect(categoryEs("Milk, whole")).toBe("Milk, whole");
    expect(categoryEs("  ")).toBeNull();
    expect(categoryEs(null)).toBeNull();
  });
});

describe("validateNutrients", () => {
  it("acepta valores plausibles (aceite: 884 kcal, 100 g de grasa)", () => {
    expect(validateNutrients({ energy_kcal: 884, fat_g: 100 })).toBeNull();
  });

  it.each([
    [{}, /sin energía/],
    [{ energy_kcal: 1200 }, /energía imposible/],
    [{ energy_kcal: 100, protein_g: 101 }, /protein_g > 100/],
    [{ energy_kcal: 100, protein_g: 50, carb_g: 40, fat_g: 20 }, /= 110/],
    [{ energy_kcal: 100, sodium_mg: 50000 }, /sodio imposible/],
  ])("rechaza %j", (nutrients, error) => {
    expect(validateNutrients(nutrients)).toMatch(error);
  });
});

const food = (over: Partial<UsdaFood> = {}): UsdaFood => ({
  fdcId: "100",
  dataType: "foundation_food",
  description: " Chicken, breast, raw ",
  categoryEn: "Poultry Products",
  nutrients: [
    { nutrientNbr: "958", unitName: "KCAL", amount: 118 },
    { nutrientNbr: "203", unitName: "G", amount: 22.5 },
  ],
  portions: [
    {
      id: "7",
      amount: "1.0",
      measureUnitName: "breast",
      portionDescription: "",
      modifier: "",
      gramWeight: "174",
    },
  ],
  ...over,
});

describe("normalizeFood", () => {
  it("arma el alimento normalizado por 100 g", () => {
    expect(normalizeFood(food(), " Pollo, pechuga, crudo ")).toEqual({
      ok: true,
      food: {
        source: "usda_fdc",
        sourceId: "100",
        nameEs: "Pollo, pechuga, crudo",
        nameEn: "Chicken, breast, raw",
        category: "Aves",
        state: "crudo",
        basis: "per_100g",
        license: "CC0 / dominio público",
        nutrients: { energy_kcal: 118, protein_g: 22.5 },
        portions: [{ sourcePortionId: "7", labelEs: "1 pechuga", grams: 174 }],
      },
    });
  });

  it("omite los alimentos sin energía y marca error si los valores son imposibles", () => {
    expect(normalizeFood(food({ nutrients: [] }), "x")).toEqual({
      ok: false,
      kind: "omitido",
      reason: "sin_energia",
    });
    expect(
      normalizeFood(
        food({ nutrients: [{ nutrientNbr: "208", unitName: "KCAL", amount: 5000 }] }),
        "x",
      ),
    ).toMatchObject({ ok: false, kind: "error" });
  });

  it("rechaza tipos de dato no importables y nombres fuera de largo", () => {
    expect(normalizeFood(food({ dataType: "sample_food" }), "x")).toMatchObject({
      ok: false,
      kind: "error",
    });
    expect(normalizeFood(food(), "x".repeat(201))).toMatchObject({
      ok: false,
      kind: "error",
    });
  });
});
