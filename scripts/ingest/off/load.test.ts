import { describe, expect, it } from "vitest";

import { buildFoodRow, buildNutrientRows, foodId } from "./load.ts";
import { OFF_LICENSE, OFF_SOURCE, type OffFood } from "./normalize.ts";

const FOOD: OffFood = {
  barcode: "7801234567890",
  nameEs: "Galletas de vainilla",
  nameEn: "Vanilla cookies",
  category: "Galletas y brownies",
  etiquetasSinMapear: [],
  brand: "Marca A",
  basis: "per_100g",
  nutrients: { protein_g: 6, energy_kcal: 480, desconocido: 1 },
  kcalDesdeKj: false,
  countries: ["CL", "PE"],
};

describe("carga de Open Food Facts", () => {
  it("el id de food es determinista por código de barras", () => {
    expect(foodId("7801234567890")).toBe(foodId("7801234567890"));
    expect(foodId("7801234567890")).not.toBe(foodId("7801234567891"));
    expect(foodId("7801234567890")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab]/,
    );
  });

  it("guarda código de barras, fuente, licencia ODbL y es público", () => {
    const row = buildFoodRow(FOOD, "2026-01-01T00:00:00.000Z");
    expect(row).toMatchObject({
      id: foodId(FOOD.barcode),
      barcode: "7801234567890",
      source: OFF_SOURCE,
      source_id: "7801234567890",
      license: OFF_LICENSE,
      owner_user_id: null,
      brand: "Marca A",
      basis: "per_100g",
      name_en: "Vanilla cookies",
      category: "Galletas y brownies",
      countries: ["CL", "PE"],
    });
    expect(OFF_LICENSE).toContain("ODbL");
  });

  it("arma food_nutrient solo con códigos conocidos, ordenado por nutrient_id", () => {
    const ids = new Map([
      ["energy_kcal", 1],
      ["protein_g", 2],
    ]);
    expect(buildNutrientRows(FOOD, ids)).toEqual([
      { food_id: foodId(FOOD.barcode), nutrient_id: 1, amount_per_100: 480 },
      { food_id: foodId(FOOD.barcode), nutrient_id: 2, amount_per_100: 6 },
    ]);
  });
});
