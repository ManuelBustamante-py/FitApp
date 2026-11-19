import { describe, expect, it } from "vitest";

import {
  buildNutrientIndex,
  convertAmount,
  mapNutrients,
  normalizeNbr,
  NUTRIENT_MAPPINGS,
} from "./nutrients.ts";

describe("buildNutrientIndex", () => {
  const index = buildNutrientIndex([
    { id: "1008", nutrientNbr: "208", unitName: "KCAL" },
    { id: "1003", nutrientNbr: "203.0", unitName: "G" },
  ]);

  it("resuelve por id (Foundation, SR Legacy) y por número (FNDDS)", () => {
    expect(index.get("1008")).toEqual({ nutrientNbr: "208", unitName: "KCAL" });
    expect(index.get("208")).toEqual({ nutrientNbr: "208", unitName: "KCAL" });
    expect(index.get("203")).toEqual({ nutrientNbr: "203", unitName: "G" });
    expect(index.get("999")).toBeUndefined();
  });

  it("normaliza números con .0 y conserva subnúmeros", () => {
    expect(normalizeNbr("208.0")).toBe("208");
    expect(normalizeNbr("205.2")).toBe("205.2");
  });
});

describe("convertAmount", () => {
  it.each([
    [100, "KCAL", "kcal", 100],
    [418.4, "kJ", "kcal", 100],
    [1, "G", "mg", 1000],
    [500, "MG", "g", 0.5],
    [2000, "UG", "mg", 2],
    [3, "µg", "µg", 3],
  ] as const)("%s %s → %s", (amount, from, to, expected) => {
    expect(convertAmount(amount, from, to)).toBeCloseTo(expected, 6);
  });

  it("devuelve null con unidades incompatibles", () => {
    expect(convertAmount(1, "G", "kcal")).toBeNull();
    expect(convertAmount(1, "IU", "mg")).toBeNull();
  });
});

describe("mapNutrients", () => {
  it("prefiere el número USDA principal y usa los alternativos si falta", () => {
    const result = mapNutrients([
      { nutrientNbr: "958", unitName: "KCAL", amount: 120 },
      { nutrientNbr: "208", unitName: "KCAL", amount: 118 },
      { nutrientNbr: "298", unitName: "G", amount: 2 },
      { nutrientNbr: "203", unitName: "G", amount: 22.5 },
    ]);
    expect(result).toEqual({ energy_kcal: 118, fat_g: 2, protein_g: 22.5 });
  });

  it("convierte kJ a kcal cuando no hay kcal y redondea a 3 decimales", () => {
    expect(mapNutrients([{ nutrientNbr: "268", unitName: "kJ", amount: 544 }])).toEqual({
      energy_kcal: 130.019,
    });
  });

  it("ignora valores negativos o no numéricos", () => {
    expect(
      mapNutrients([
        { nutrientNbr: "203", unitName: "G", amount: -1 },
        { nutrientNbr: "204", unitName: "G", amount: Number.NaN },
      ]),
    ).toEqual({});
  });

  it("cubre todos los códigos sembrados en public.nutrient", () => {
    expect(NUTRIENT_MAPPINGS.map((m) => m.code).sort()).toEqual(
      [
        "alcohol_g",
        "carb_g",
        "cholesterol_mg",
        "energy_kcal",
        "fat_g",
        "fat_saturated_g",
        "fat_trans_g",
        "fiber_g",
        "protein_g",
        "sodium_mg",
        "sugar_g",
      ].sort(),
    );
  });
});
