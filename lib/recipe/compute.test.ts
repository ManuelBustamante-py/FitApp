import { describe, expect, it } from "vitest";

import { computeRecipePer100, servingGrams, type RecipeIngredientInput } from "./compute";
import { parseRecipeForm } from "./schema";

const rice: RecipeIngredientInput = {
  name: "Arroz crudo",
  basis: "per_100g",
  densityGMl: null,
  per100: { energy_kcal: 360, protein_g: 7, carb_g: 80, fat_g: 0.6 },
  grams: 200,
};
const oil: RecipeIngredientInput = {
  name: "Aceite",
  basis: "per_100g",
  densityGMl: null,
  per100: { energy_kcal: 884, fat_g: 100 },
  grams: 10,
};

describe("computeRecipePer100", () => {
  it("suma ingredientes y divide por el peso cocido", () => {
    const r = computeRecipePer100([rice, oil], 500);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // energía: (720 + 88,4) / 500 × 100 = 161,68
    expect(r.per100.energy_kcal).toBeCloseTo(161.68, 3);
    expect(r.per100.protein_g).toBeCloseTo(2.8, 3);
    expect(r.per100.carb_g).toBeCloseTo(32, 3);
    expect(r.per100.fat_g).toBeCloseTo(2.24, 3);
    expect(r.totalIngredientGrams).toBe(210);
    expect(r.kcalEstimated).toBe(false);
  });

  it("estima la energía con Atwater si un ingrediente no la informa", () => {
    const r = computeRecipePer100(
      [{ ...rice, per100: { protein_g: 10, carb_g: 10 }, grams: 100 }],
      100,
    );
    expect(r.ok && r.per100.energy_kcal).toBe(80);
    expect(r.ok && r.kcalEstimated).toBe(true);
  });

  it("un peso cocido menor concentra los nutrientes", () => {
    const a = computeRecipePer100([rice], 400);
    const b = computeRecipePer100([rice], 800);
    expect(a.ok && b.ok && a.per100.energy_kcal / b.per100.energy_kcal).toBeCloseTo(2);
  });

  it("rechaza peso cocido no positivo y receta vacía", () => {
    expect(computeRecipePer100([rice], 0).ok).toBe(false);
    expect(computeRecipePer100([], 100).ok).toBe(false);
  });

  it("rechaza macros por 100 g sobre 105 g", () => {
    expect(computeRecipePer100([rice], 100).ok).toBe(false);
  });

  it("rechaza un ingrediente sin energía ni macros", () => {
    expect(computeRecipePer100([{ ...rice, per100: { sodium_mg: 5 } }], 100).ok).toBe(
      false,
    );
  });
});

describe("servingGrams", () => {
  it("peso cocido / porciones", () => {
    expect(servingGrams(900, 4)).toBe(225);
    expect(servingGrams(1000, 3)).toBe(333.3);
  });
});

describe("parseRecipeForm", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("acepta una receta válida y suma ingredientes repetidos", () => {
    const r = parseRecipeForm({
      name: "  Sopa  casera ",
      cookedWeight: "1200,5",
      servings: "4",
      ingredients: JSON.stringify([
        { foodId: id, grams: 100 },
        { foodId: id, grams: "50" },
      ]),
    });
    expect(r.success && r.data).toEqual({
      name: "Sopa casera",
      cookedWeightG: 1200.5,
      servings: 4,
      ingredients: [{ foodId: id, grams: 150 }],
    });
  });

  it("reporta errores", () => {
    const r = parseRecipeForm({ name: "", cookedWeight: "0", ingredients: "[]" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(Object.keys(r.errors).sort()).toEqual([
        "cookedWeight",
        "ingredients",
        "name",
      ]);
  });
});
