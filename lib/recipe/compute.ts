import { itemNutrition, resolveQuantity, type FoodBasis } from "@/lib/calc";
import {
  MAX_GRAMS_100,
  MAX_KCAL_100,
  MAX_MACRO_SUM_100,
  MAX_SODIUM_MG_100,
} from "@/lib/food/custom";

/** Ingrediente ya leído desde la base: nutrientes por 100 g/ml y gramos usados. */
export interface RecipeIngredientInput {
  name: string;
  basis: FoodBasis;
  densityGMl: number | null;
  per100: Readonly<Record<string, number>>;
  grams: number;
}

export type RecipeComputeResult =
  | {
      ok: true;
      /** Código de nutriente → cantidad por 100 g de receta cocida (3 decimales). */
      per100: Record<string, number>;
      /** Suma de los gramos de los ingredientes. */
      totalIngredientGrams: number;
      /** true si alguna energía se estimó desde los macros. */
      kcalEstimated: boolean;
    }
  | { ok: false; message: string };

const round = (value: number, decimals: number) =>
  Math.round(Number((value * 10 ** decimals).toPrecision(12))) / 10 ** decimals;

/**
 * Nutrientes por 100 g de una receta (RF-20):
 * `por 100 g = suma(nutriente del ingrediente × gramos / 100) / peso cocido × 100`.
 * La energía de un ingrediente sin energía se estima con Atwater (docs/03 §5). Un
 * nutriente que ningún ingrediente informa no aparece. Valida los umbrales USDA/OMS
 * por 100 g (energía, nutrientes, sodio y suma de macros ≤ 105 g).
 */
export function computeRecipePer100(
  ingredients: readonly RecipeIngredientInput[],
  cookedWeightG: number,
): RecipeComputeResult {
  if (!Number.isFinite(cookedWeightG) || cookedWeightG <= 0)
    return { ok: false, message: "El peso cocido debe ser mayor que 0." };
  if (ingredients.length === 0)
    return { ok: false, message: "Agrega al menos un ingrediente." };

  const totals: Record<string, number> = {};
  let kcalEstimated = false;
  let totalIngredientGrams = 0;
  for (const ingredient of ingredients) {
    if (!Number.isFinite(ingredient.grams) || ingredient.grams <= 0)
      return { ok: false, message: `Los gramos de ${ingredient.name} deben ser > 0.` };
    totalIngredientGrams += ingredient.grams;
    const { basisAmount } = resolveQuantity({
      basis: ingredient.basis,
      densityGMl: ingredient.densityGMl,
      unit: "g",
      quantity: ingredient.grams,
    });
    const item = itemNutrition(ingredient.per100, basisAmount);
    if (!item)
      return {
        ok: false,
        message: `${ingredient.name} no informa energía ni macronutrientes.`,
      };
    if (item.kcalEstimated) kcalEstimated = true;
    const nutrients = { ...item.nutrients, energy_kcal: item.kcal };
    for (const [code, value] of Object.entries(nutrients))
      totals[code] = (totals[code] ?? 0) + value;
  }

  const per100: Record<string, number> = {};
  for (const [code, total] of Object.entries(totals))
    per100[code] = round((total / cookedWeightG) * 100, 3);

  const hint = " Revisa los gramos de los ingredientes y el peso cocido.";
  if (per100.energy_kcal > MAX_KCAL_100)
    return {
      ok: false,
      message: `La receta supera ${MAX_KCAL_100} kcal por 100 g (${round(per100.energy_kcal, 0)}).${hint}`,
    };
  for (const [code, value] of Object.entries(per100)) {
    if (code === "energy_kcal") continue;
    const max = code.endsWith("_mg") ? MAX_SODIUM_MG_100 : MAX_GRAMS_100;
    if (value > max)
      return { ok: false, message: `Un nutriente supera ${max} por 100 g.${hint}` };
  }
  const macroSum = (per100.protein_g ?? 0) + (per100.fat_g ?? 0) + (per100.carb_g ?? 0);
  if (macroSum > MAX_MACRO_SUM_100)
    return {
      ok: false,
      message: `Proteínas + grasas + carbohidratos suman ${round(macroSum, 1)} g por 100 g; el máximo es ${MAX_MACRO_SUM_100}.${hint}`,
    };
  return { ok: true, per100, totalIngredientGrams, kcalEstimated };
}

/** Gramos de una porción: peso cocido / número de porciones (1 decimal). */
export function servingGrams(cookedWeightG: number, servings: number): number {
  return round(cookedWeightG / servings, 1);
}
