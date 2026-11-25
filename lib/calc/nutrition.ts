import { assertPositive } from "./common";

/** Base de los valores nutricionales del alimento (mismo CHECK que `food.basis`). */
export type FoodBasis = "per_100g" | "per_100ml";

/** Unidad de una cantidad registrada (mismo CHECK que `meal_item.unit`). */
export type QuantityUnit = "g" | "ml" | "portion";

/** Densidad que se asume cuando un líquido no la informa (docs/03 §5). */
export const DEFAULT_DENSITY_G_ML = 1;

/** kcal por gramo de cada macronutriente (factores de Atwater, docs/03 §5). */
export const ATWATER = { protein: 4, carb: 4, fat: 9, alcohol: 7 } as const;

/** Unidad en que se expresa la base del alimento. */
export function basisUnit(basis: FoodBasis): "g" | "ml" {
  return basis === "per_100ml" ? "ml" : "g";
}

export interface QuantityInput {
  basis: FoodBasis;
  /** g/ml del alimento; null si no se conoce. */
  densityGMl: number | null;
  unit: QuantityUnit;
  /** g, ml o número de porciones según `unit`. */
  quantity: number;
  /** Gramos de una porción; obligatorio si `unit` es "portion". */
  portionGrams?: number | null;
}

export interface ResolvedQuantity {
  /** Gramos que se comieron. */
  grams: number;
  /** Cantidad en la unidad de la base (g si per_100g, ml si per_100ml). */
  basisAmount: number;
  /** true si hubo que convertir g↔ml sin densidad informada (se asumió 1 g/ml). */
  densityAssumed: boolean;
}

/**
 * Convierte la cantidad registrada a gramos y a la unidad de la base del alimento.
 * - g y ml se aceptan en cualquier base; si no coinciden se usa la densidad.
 * - Porciones caseras: `gramos = n × gramos_por_porción` (docs/03 §5).
 */
export function resolveQuantity(input: QuantityInput): ResolvedQuantity {
  const { basis, densityGMl, unit, quantity, portionGrams } = input;
  assertPositive(quantity, "quantity");
  if (densityGMl !== null) assertPositive(densityGMl, "densityGMl");
  const density = densityGMl ?? DEFAULT_DENSITY_G_ML;

  let grams: number;
  let ml: number | null = null;
  if (unit === "portion") {
    if (portionGrams == null)
      throw new RangeError("portionGrams es obligatorio para unit = portion");
    assertPositive(portionGrams, "portionGrams");
    grams = quantity * portionGrams;
  } else if (unit === "ml") {
    ml = quantity;
    grams = quantity * density;
  } else {
    grams = quantity;
  }

  const target = basisUnit(basis);
  if (target === "g") {
    return {
      grams,
      basisAmount: grams,
      densityAssumed: ml !== null && densityGMl === null,
    };
  }
  return {
    grams,
    basisAmount: ml ?? grams / density,
    densityAssumed: ml === null && densityGMl === null,
  };
}

/** Escala valores por 100 (g o ml) a una cantidad en la unidad de la base. */
export function scaleNutrients(
  per100: Readonly<Record<string, number>>,
  basisAmount: number,
): Record<string, number> {
  assertPositive(basisAmount, "basisAmount");
  const factor = basisAmount / 100;
  const scaled: Record<string, number> = {};
  for (const [code, value] of Object.entries(per100)) {
    if (!Number.isFinite(value) || value < 0) continue;
    scaled[code] = value * factor;
  }
  return scaled;
}

/** kcal ≈ 4·P + 4·C + 9·G (+ 7·alcohol) cuando el alimento no informa energía. */
export function kcalFromMacros(macros: {
  proteinG?: number;
  carbG?: number;
  fatG?: number;
  alcoholG?: number;
}): number {
  return (
    ATWATER.protein * (macros.proteinG ?? 0) +
    ATWATER.carb * (macros.carbG ?? 0) +
    ATWATER.fat * (macros.fatG ?? 0) +
    ATWATER.alcohol * (macros.alcoholG ?? 0)
  );
}

export interface ItemNutrition {
  kcal: number;
  /** true si las kcal se estimaron desde los macronutrientes. */
  kcalEstimated: boolean;
  proteinG: number;
  carbG: number;
  fatG: number;
  /** Todos los nutrientes informados, escalados (código → cantidad). */
  nutrients: Record<string, number>;
  /** Macronutrientes que el alimento no informa (se cuentan como 0). */
  missing: ("protein_g" | "carb_g" | "fat_g")[];
}

/**
 * Nutrientes de un ítem: `valor = valor_por_100 × cantidad / 100` (docs/03 §5), con
 * códigos de `public.nutrient`. Sin redondear. Devuelve null si el alimento no
 * informa energía ni ningún macronutriente (no se puede calcular).
 */
export function itemNutrition(
  per100: Readonly<Record<string, number>>,
  basisAmount: number,
): ItemNutrition | null {
  const nutrients = scaleNutrients(per100, basisAmount);
  const macroCodes = ["protein_g", "carb_g", "fat_g"] as const;
  const missing = macroCodes.filter((code) => nutrients[code] === undefined);
  const hasEnergy = nutrients.energy_kcal !== undefined;
  if (!hasEnergy && missing.length === macroCodes.length) return null;

  const proteinG = nutrients.protein_g ?? 0;
  const carbG = nutrients.carb_g ?? 0;
  const fatG = nutrients.fat_g ?? 0;
  const kcal = hasEnergy
    ? nutrients.energy_kcal
    : kcalFromMacros({ proteinG, carbG, fatG, alcoholG: nutrients.alcohol_g });
  return { kcal, kcalEstimated: !hasEnergy, proteinG, carbG, fatG, nutrients, missing };
}
