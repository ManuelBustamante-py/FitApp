/**
 * Mapeo de nutrientes de USDA FoodData Central a la tabla `nutrient` de FitApp.
 *
 * USDA identifica cada nutriente por `nutrient.id` (1008, 1003…) y por su número
 * clásico `nutrient_nbr` (208, 203…). Foundation y SR Legacy usan el id en
 * `food_nutrient.nutrient_id`; FNDDS usa el número. Por eso el mapeo se hace por
 * número, que existe en las tres fuentes.
 *
 * Para cada código de FitApp se listan los números USDA en orden de preferencia:
 * se usa el primero que tenga valor para ese alimento.
 */

export type TargetUnit = "kcal" | "g" | "mg" | "µg";

export interface NutrientMapping {
  /** Código en public.nutrient. */
  code: string;
  /** Unidad en public.nutrient. */
  unit: TargetUnit;
  /** Números USDA (nutrient_nbr) en orden de preferencia. */
  usdaNumbers: readonly string[];
}

export const NUTRIENT_MAPPINGS: readonly NutrientMapping[] = [
  // 208 Energy (kcal); 958/957 Energy (Atwater específico/general), usados por
  // Foundation; 268 Energy (kJ) como último recurso, convertido a kcal.
  { code: "energy_kcal", unit: "kcal", usdaNumbers: ["208", "958", "957", "268"] },
  { code: "protein_g", unit: "g", usdaNumbers: ["203"] },
  // 205 Carbohydrate, by difference; 205.2 Carbohydrate, by summation.
  { code: "carb_g", unit: "g", usdaNumbers: ["205", "205.2"] },
  // 269 Total Sugars; 269.3 Sugars, Total (Foundation).
  { code: "sugar_g", unit: "g", usdaNumbers: ["269", "269.3"] },
  // 291 Fiber, total dietary; 293 Total dietary fiber (AOAC 2011.25).
  { code: "fiber_g", unit: "g", usdaNumbers: ["291", "293"] },
  // 204 Total lipid (fat); 298 Total fat (NLEA).
  { code: "fat_g", unit: "g", usdaNumbers: ["204", "298"] },
  { code: "fat_saturated_g", unit: "g", usdaNumbers: ["606"] },
  { code: "fat_trans_g", unit: "g", usdaNumbers: ["605"] },
  { code: "cholesterol_mg", unit: "mg", usdaNumbers: ["601"] },
  { code: "sodium_mg", unit: "mg", usdaNumbers: ["307"] },
  { code: "alcohol_g", unit: "g", usdaNumbers: ["221"] },
];

/** Números USDA que interesan (para filtrar food_nutrient.csv al leerlo). */
export const RELEVANT_USDA_NUMBERS: ReadonlySet<string> = new Set(
  NUTRIENT_MAPPINGS.flatMap((m) => m.usdaNumbers),
);

/** Fila de nutrient.csv de USDA. */
export interface UsdaNutrientDef {
  id: string;
  nutrientNbr: string;
  unitName: string;
}

export interface ResolvedUsdaNutrient {
  nutrientNbr: string;
  unitName: string;
}

/**
 * Índice para resolver el valor de `food_nutrient.nutrient_id`, que puede ser el
 * id (Foundation, SR Legacy) o el número (FNDDS). El id tiene prioridad.
 */
export function buildNutrientIndex(
  defs: Iterable<UsdaNutrientDef>,
): Map<string, ResolvedUsdaNutrient> {
  const byId = new Map<string, ResolvedUsdaNutrient>();
  const byNbr = new Map<string, ResolvedUsdaNutrient>();
  for (const def of defs) {
    const resolved = {
      nutrientNbr: normalizeNbr(def.nutrientNbr),
      unitName: def.unitName,
    };
    byId.set(def.id.trim(), resolved);
    if (resolved.nutrientNbr && !byNbr.has(resolved.nutrientNbr)) {
      byNbr.set(resolved.nutrientNbr, resolved);
    }
  }
  const index = new Map(byNbr);
  for (const [id, resolved] of byId) index.set(id, resolved);
  return index;
}

/** "208.0" → "208"; "205.2" se conserva. */
export function normalizeNbr(value: string): string {
  const trimmed = value.trim();
  return /^\d+\.0+$/.test(trimmed) ? trimmed.replace(/\.0+$/, "") : trimmed;
}

const MASS_IN_G: Record<string, number> = { G: 1, MG: 1e-3, UG: 1e-6 };

function canonicalUnit(unit: string): string {
  const u = unit.trim().toUpperCase();
  if (u === "µG" || u === "MCG" || u === "ΜG") return "UG";
  return u;
}

/** Convierte una cantidad entre unidades de USDA y de FitApp; null si no son compatibles. */
export function convertAmount(
  amount: number,
  fromUnit: string,
  toUnit: TargetUnit,
): number | null {
  const from = canonicalUnit(fromUnit);
  const to = canonicalUnit(toUnit);
  if (to === "KCAL") {
    if (from === "KCAL") return amount;
    if (from === "KJ") return amount / 4.184;
    return null;
  }
  if (from in MASS_IN_G && to in MASS_IN_G) {
    return (amount * MASS_IN_G[from]) / MASS_IN_G[to];
  }
  return null;
}

/** Valor de un nutriente USDA para un alimento (por 100 g). */
export interface UsdaNutrientValue {
  nutrientNbr: string;
  unitName: string;
  amount: number;
}

/**
 * Elige, para cada código de FitApp, el valor del número USDA preferido que
 * esté presente y lo convierte a la unidad de FitApp (redondeado a 3 decimales,
 * como numeric(10, 3)).
 */
export function mapNutrients(
  values: Iterable<UsdaNutrientValue>,
): Record<string, number> {
  const byNbr = new Map<string, UsdaNutrientValue>();
  for (const value of values) {
    if (!Number.isFinite(value.amount) || value.amount < 0) continue;
    if (!byNbr.has(value.nutrientNbr)) byNbr.set(value.nutrientNbr, value);
  }
  const result: Record<string, number> = {};
  for (const mapping of NUTRIENT_MAPPINGS) {
    for (const nbr of mapping.usdaNumbers) {
      const value = byNbr.get(nbr);
      if (!value) continue;
      const converted = convertAmount(value.amount, value.unitName, mapping.unit);
      if (converted === null) continue;
      result[mapping.code] = Math.round(converted * 1000) / 1000;
      break;
    }
  }
  return result;
}
