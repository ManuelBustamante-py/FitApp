import { describe, expect, it } from "vitest";

import {
  basisUnit,
  itemNutrition,
  kcalFromMacros,
  resolveQuantity,
  scaleNutrients,
} from "./nutrition";

describe("basisUnit", () => {
  it("g para per_100g y ml para per_100ml", () => {
    expect(basisUnit("per_100g")).toBe("g");
    expect(basisUnit("per_100ml")).toBe("ml");
  });
});

describe("resolveQuantity", () => {
  it("gramos sobre base per_100g", () => {
    expect(
      resolveQuantity({ basis: "per_100g", densityGMl: null, unit: "g", quantity: 180 }),
    ).toEqual({ grams: 180, basisAmount: 180, densityAssumed: false });
  });

  it("ml sobre base per_100ml usa la densidad solo para los gramos", () => {
    expect(
      resolveQuantity({
        basis: "per_100ml",
        densityGMl: 1.03,
        unit: "ml",
        quantity: 200,
      }),
    ).toEqual({ grams: 206, basisAmount: 200, densityAssumed: false });
  });

  it("ml sin densidad asume 1 g/ml para los gramos sin marcarlo (la base es ml)", () => {
    expect(
      resolveQuantity({
        basis: "per_100ml",
        densityGMl: null,
        unit: "ml",
        quantity: 250,
      }),
    ).toEqual({ grams: 250, basisAmount: 250, densityAssumed: false });
  });

  it("ml sobre base per_100g convierte con la densidad", () => {
    expect(
      resolveQuantity({ basis: "per_100g", densityGMl: 0.5, unit: "ml", quantity: 10 }),
    ).toEqual({ grams: 5, basisAmount: 5, densityAssumed: false });
    expect(
      resolveQuantity({ basis: "per_100g", densityGMl: null, unit: "ml", quantity: 10 }),
    ).toEqual({ grams: 10, basisAmount: 10, densityAssumed: true });
  });

  it("g sobre base per_100ml convierte con la densidad", () => {
    const r = resolveQuantity({
      basis: "per_100ml",
      densityGMl: 1.25,
      unit: "g",
      quantity: 50,
    });
    expect(r).toEqual({ grams: 50, basisAmount: 40, densityAssumed: false });
    expect(
      resolveQuantity({ basis: "per_100ml", densityGMl: null, unit: "g", quantity: 50 })
        .densityAssumed,
    ).toBe(true);
  });

  it("porciones: gramos = n × gramos por porción", () => {
    expect(
      resolveQuantity({
        basis: "per_100g",
        densityGMl: null,
        unit: "portion",
        quantity: 1.5,
        portionGrams: 158,
      }),
    ).toEqual({ grams: 237, basisAmount: 237, densityAssumed: false });
  });

  it("porción de un líquido pasa a ml con la densidad (o 1 g/ml marcado)", () => {
    expect(
      resolveQuantity({
        basis: "per_100ml",
        densityGMl: 1.04,
        unit: "portion",
        quantity: 1,
        portionGrams: 260,
      }),
    ).toEqual({ grams: 260, basisAmount: 250, densityAssumed: false });
    expect(
      resolveQuantity({
        basis: "per_100ml",
        densityGMl: null,
        unit: "portion",
        quantity: 2,
        portionGrams: 240,
      }),
    ).toEqual({ grams: 480, basisAmount: 480, densityAssumed: true });
  });

  it("rechaza cantidades, densidades y porciones inválidas", () => {
    const base = { basis: "per_100g", densityGMl: null, unit: "g" } as const;
    expect(() => resolveQuantity({ ...base, quantity: 0 })).toThrow(RangeError);
    expect(() => resolveQuantity({ ...base, quantity: Number.NaN })).toThrow(RangeError);
    expect(() => resolveQuantity({ ...base, densityGMl: 0, quantity: 10 })).toThrow(
      RangeError,
    );
    expect(() => resolveQuantity({ ...base, unit: "portion", quantity: 1 })).toThrow(
      /portionGrams/,
    );
    expect(() =>
      resolveQuantity({ ...base, unit: "portion", quantity: 1, portionGrams: -5 }),
    ).toThrow(RangeError);
  });
});

describe("scaleNutrients", () => {
  it("escala todos los nutrientes por cantidad / 100", () => {
    expect(scaleNutrients({ energy_kcal: 130, sodium_mg: 1 }, 180)).toEqual({
      energy_kcal: 234,
      sodium_mg: 1.8,
    });
  });

  it("conserva los ceros y descarta valores inválidos", () => {
    expect(scaleNutrients({ fat_g: 0, sugar_g: -1, fiber_g: Number.NaN }, 50)).toEqual({
      fat_g: 0,
    });
  });

  it("rechaza una cantidad no positiva", () => {
    expect(() => scaleNutrients({ energy_kcal: 100 }, 0)).toThrow(RangeError);
  });
});

describe("kcalFromMacros", () => {
  it("usa 4/4/9/7 kcal por gramo", () => {
    expect(kcalFromMacros({ proteinG: 10, carbG: 20, fatG: 5, alcoholG: 2 })).toBe(
      40 + 80 + 45 + 14,
    );
    expect(kcalFromMacros({})).toBe(0);
  });
});

describe("itemNutrition", () => {
  it("HU-03: arroz cocido 180 g → 234 kcal y macros escalados", () => {
    const r = itemNutrition(
      { energy_kcal: 130, protein_g: 2.7, carb_g: 28, fat_g: 0.3, fiber_g: 0.4 },
      180,
    );
    expect(r).not.toBeNull();
    expect(r?.kcal).toBeCloseTo(234, 6);
    expect(r?.proteinG).toBeCloseTo(4.86, 6);
    expect(r?.carbG).toBeCloseTo(50.4, 6);
    expect(r?.fatG).toBeCloseTo(0.54, 6);
    expect(r?.nutrients.fiber_g).toBeCloseTo(0.72, 6);
    expect(r?.kcalEstimated).toBe(false);
    expect(r?.missing).toEqual([]);
  });

  it("macros faltantes cuentan como 0 y se informan", () => {
    const r = itemNutrition({ energy_kcal: 40, carb_g: 10 }, 100);
    expect(r).toMatchObject({
      kcal: 40,
      proteinG: 0,
      carbG: 10,
      fatG: 0,
      missing: ["protein_g", "fat_g"],
    });
    expect(r?.nutrients).toEqual({ energy_kcal: 40, carb_g: 10 });
  });

  it("sin energía estima las kcal con los macros (y el alcohol)", () => {
    const r = itemNutrition({ protein_g: 1, carb_g: 2, fat_g: 0, alcohol_g: 10 }, 200);
    expect(r?.kcal).toBe(4 * 2 + 4 * 4 + 7 * 20);
    expect(r?.kcalEstimated).toBe(true);
    expect(r?.nutrients.energy_kcal).toBeUndefined();
  });

  it("sin energía ni macros no se puede calcular", () => {
    expect(itemNutrition({ sodium_mg: 300 }, 100)).toBeNull();
    expect(itemNutrition({}, 100)).toBeNull();
  });

  it("solo energía: macros en 0 y todos faltantes", () => {
    expect(itemNutrition({ energy_kcal: 50 }, 100)?.missing).toEqual([
      "protein_g",
      "carb_g",
      "fat_g",
    ]);
  });
});
