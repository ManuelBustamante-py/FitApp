import { basisUnit, itemNutrition, resolveQuantity, type FoodBasis } from "@/lib/calc";

import type { MealItemFieldErrors, MealItemFormValues } from "./schema";

/** Alimento tal como se lee en el servidor para registrarlo. */
export interface FoodForLogging {
  basis: FoodBasis;
  densityGMl: number | null;
  /** Nutrientes por 100 g o 100 ml (código de `nutrient` → cantidad). */
  per100: Record<string, number>;
  portions: readonly { id: string; grams: number }[];
}

/** Columnas de `meal_item` que forman la instantánea (RF-21 del modelo de datos). */
export interface MealItemSnapshot {
  quantity: number;
  unit: MealItemFormValues["unit"];
  portion_id: string | null;
  grams_resolved: number;
  kcal: number;
  kcal_estimated: boolean;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  /** Todos los nutrientes informados, escalados y redondeados a 2 decimales. */
  nutrients: Record<string, number>;
}

export type SnapshotResult =
  | { ok: true; snapshot: MealItemSnapshot; densityAssumed: boolean }
  | { ok: false; errors: MealItemFieldErrors; message?: string };

/** Redondeo half-up estable (evita 1,005 → 1,00 por el binario). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(Number((value * factor).toPrecision(12))) / factor;
}

/** Normaliza `food.basis` (text en la base) al tipo de la calculadora. */
export function toBasis(value: string): FoodBasis {
  return value === "per_100ml" ? "per_100ml" : "per_100g";
}

/**
 * Calcula la instantánea de nutrientes de un ítem a partir del alimento leído en el
 * servidor. kcal, macros y gramos van con 1 decimal (como las columnas numeric(·,1));
 * el resto de los nutrientes, con 2. Rechaza una unidad que no corresponde a la base
 * del alimento, una porción ajena y alimentos sin energía ni macros.
 */
export function buildMealItemSnapshot(
  food: FoodForLogging,
  values: Pick<MealItemFormValues, "unit" | "quantity" | "portionId">,
): SnapshotResult {
  const { unit, quantity, portionId } = values;
  let portionGrams: number | null = null;
  if (unit === "portion") {
    const portion = food.portions.find((p) => p.id === portionId);
    if (!portion)
      return { ok: false, errors: { portionId: "Elige una porción válida." } };
    portionGrams = portion.grams;
  } else if (unit !== basisUnit(food.basis)) {
    return {
      ok: false,
      errors: { unit: `Este alimento se registra en ${basisUnit(food.basis)}.` },
    };
  }

  const resolved = resolveQuantity({
    basis: food.basis,
    densityGMl: food.densityGMl,
    unit,
    quantity,
    portionGrams,
  });
  const gramsResolved = roundTo(resolved.grams, 1);
  if (gramsResolved <= 0)
    return { ok: false, errors: { quantity: "La cantidad es demasiado pequeña." } };

  const nutrition = itemNutrition(food.per100, resolved.basisAmount);
  if (!nutrition)
    return {
      ok: false,
      errors: {},
      message:
        "Este alimento no informa energía ni macronutrientes; no se puede registrar.",
    };

  const nutrients: Record<string, number> = {};
  for (const [code, value] of Object.entries(nutrition.nutrients))
    nutrients[code] = roundTo(value, 2);

  return {
    ok: true,
    densityAssumed: resolved.densityAssumed,
    snapshot: {
      quantity,
      unit,
      portion_id: unit === "portion" ? (portionId ?? null) : null,
      grams_resolved: gramsResolved,
      kcal: roundTo(nutrition.kcal, 1),
      kcal_estimated: nutrition.kcalEstimated,
      protein_g: roundTo(nutrition.proteinG, 1),
      carb_g: roundTo(nutrition.carbG, 1),
      fat_g: roundTo(nutrition.fatG, 1),
      nutrients,
    },
  };
}
