import { z } from "zod";

import { toNumber } from "@/lib/activity/schema";
import { kcalFromMacros, type FoodBasis } from "@/lib/calc";

/** Umbrales USDA/OMS por 100 g o 100 ml (los mismos del ETL de Open Food Facts). */
export const MAX_KCAL_100 = 900;
export const MAX_GRAMS_100 = 100;
export const MAX_MACRO_SUM_100 = 105;
/** Sodio por 100 g/ml: la sal pura tiene ~39 300 mg de sodio por 100 g. */
export const MAX_SODIUM_MG_100 = 40000;
export const MAX_NAME_LENGTH = 200;
export const MAX_BRAND_LENGTH = 100;
/** Tamaño de porción de la etiqueta, en g o ml. */
export const PORTION_RANGE = { min: 0.1, max: 5000 } as const;

/** Campo del formulario → código de `public.nutrient`, unidad y etiqueta. */
export const NUTRIENT_FIELDS = [
  { field: "energy", code: "energy_kcal", label: "Energía", unit: "kcal" },
  { field: "protein", code: "protein_g", label: "Proteínas", unit: "g" },
  { field: "fat", code: "fat_g", label: "Grasas totales", unit: "g" },
  { field: "saturated", code: "fat_saturated_g", label: "Grasas saturadas", unit: "g" },
  { field: "trans", code: "fat_trans_g", label: "Grasas trans", unit: "g" },
  { field: "carb", code: "carb_g", label: "Carbohidratos", unit: "g" },
  { field: "sugar", code: "sugar_g", label: "Azúcares totales", unit: "g" },
  { field: "fiber", code: "fiber_g", label: "Fibra dietética", unit: "g" },
  { field: "sodium", code: "sodium_mg", label: "Sodio", unit: "mg" },
] as const;

type NutrientField = (typeof NUTRIENT_FIELDS)[number]["field"];

export type CustomFoodField =
  "name" | "brand" | "basis" | "entry" | "portionSize" | "form" | NutrientField;

export type CustomFoodFieldErrors = Partial<Record<CustomFoodField, string>>;

export interface CustomFoodValues {
  name: string;
  brand: string | null;
  basis: FoodBasis;
  /** Tamaño de porción (g o ml según la base); null si no se indicó. */
  portionSize: number | null;
  /** Código de nutriente → cantidad por 100 g/ml (3 decimales). */
  nutrients: Record<string, number>;
  /** true si las kcal se calcularon desde los macronutrientes. */
  kcalEstimated: boolean;
}

export type CustomFoodParseResult =
  | { success: true; data: CustomFoodValues }
  | { success: false; errors: CustomFoodFieldErrors };

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const schema = z.object({
  basis: z.enum(["per_100g", "per_100ml"]),
  entry: z.enum(["per100", "portion"]),
});

/** Convierte un valor por porción a por 100 g/ml. */
export function toPer100(value: number, portionSize: number): number {
  return round((value * 100) / portionSize, 3);
}

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Valida el formulario de alimento personalizado (RF-19). Los nutrientes se ingresan
 * por porción o por 100 g/ml; siempre se guardan por 100. Si falta la energía se
 * estima con Atwater (4P + 4C + 9G). Los límites se aplican sobre los valores por 100.
 */
export function parseCustomFoodForm(
  input: FormData | Record<string, unknown>,
): CustomFoodParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const errors: CustomFoodFieldErrors = {};

  const name = clean(get("name"));
  if (name === "" || name.length > MAX_NAME_LENGTH)
    errors.name = `Ingresa el nombre (hasta ${MAX_NAME_LENGTH} caracteres).`;

  const brand = clean(get("brand"));
  if (brand.length > MAX_BRAND_LENGTH)
    errors.brand = `La marca admite hasta ${MAX_BRAND_LENGTH} caracteres.`;

  const base = schema.safeParse({ basis: get("basis"), entry: get("entry") });
  if (!base.success) {
    for (const issue of base.error.issues) {
      if (issue.path[0] === "basis") errors.basis = "Elige gramos o mililitros.";
      if (issue.path[0] === "entry") errors.entry = "Elige cómo ingresas los valores.";
    }
  }
  const entry = base.success ? base.data.entry : null;

  // El tamaño de porción es obligatorio si los valores son por porción; si se
  // informa igualmente, se guarda como porción del alimento.
  let portionSize: number | null = null;
  const rawSizeText = clean(get("portionSize"));
  if (entry === "portion" || rawSizeText !== "") {
    const raw = toNumber(rawSizeText);
    const size = raw === null || !Number.isFinite(raw) ? null : round(raw, 1);
    if (size === null || size < PORTION_RANGE.min || size > PORTION_RANGE.max)
      errors.portionSize = `Ingresa el tamaño de la porción (entre ${PORTION_RANGE.min} y ${PORTION_RANGE.max}).`;
    else portionSize = size;
  }

  // Valores tal como están en la etiqueta (por porción o por 100).
  const entered: Partial<Record<NutrientField, number>> = {};
  for (const { field, label } of NUTRIENT_FIELDS) {
    const text = clean(get(field));
    if (text === "") continue;
    const value = toNumber(text);
    if (value === null || !Number.isFinite(value) || value < 0)
      errors[field] = `${label}: ingresa un número mayor o igual a 0.`;
    else entered[field] = value;
  }

  if (!base.success || Object.keys(errors).length > 0) return { success: false, errors };

  const divisor = entry === "portion" ? portionSize : null;
  const nutrients: Record<string, number> = {};
  for (const { field, code } of NUTRIENT_FIELDS) {
    const value = entered[field];
    if (value === undefined) continue;
    nutrients[code] = divisor === null ? round(value, 3) : toPer100(value, divisor);
  }

  let kcalEstimated = false;
  if (nutrients.energy_kcal === undefined) {
    const hasMacro = ["protein_g", "fat_g", "carb_g"].some(
      (code) => nutrients[code] !== undefined,
    );
    if (!hasMacro)
      return {
        success: false,
        errors: {
          energy: "Ingresa la energía o, al menos, proteínas, grasas o carbohidratos.",
        },
      };
    nutrients.energy_kcal = round(
      kcalFromMacros({
        proteinG: nutrients.protein_g,
        fatG: nutrients.fat_g,
        carbG: nutrients.carb_g,
      }),
      1,
    );
    kcalEstimated = true;
  }

  const hint = divisor === null ? "" : " Revisa el valor y el tamaño de la porción.";
  if (nutrients.energy_kcal > MAX_KCAL_100)
    errors.energy = `La energía supera ${MAX_KCAL_100} kcal por 100 g/ml.${hint}`;
  for (const { field, code, label, unit } of NUTRIENT_FIELDS) {
    if (unit === "kcal" || nutrients[code] === undefined) continue;
    const max = unit === "mg" ? MAX_SODIUM_MG_100 : MAX_GRAMS_100;
    if (nutrients[code] > max)
      errors[field] = `${label} supera ${max} ${unit} por 100 g/ml.${hint}`;
  }
  const macroSum =
    (nutrients.protein_g ?? 0) + (nutrients.fat_g ?? 0) + (nutrients.carb_g ?? 0);
  if (macroSum > MAX_MACRO_SUM_100 && !errors.protein && !errors.fat && !errors.carb)
    errors.form = `Proteínas + grasas + carbohidratos suman ${round(macroSum, 1)} g por 100 g/ml; el máximo es ${MAX_MACRO_SUM_100}.${hint}`;

  const parts = [
    [
      "saturated",
      "fat_saturated_g",
      "fat_g",
      "Las grasas saturadas",
      "las grasas totales",
    ],
    ["trans", "fat_trans_g", "fat_g", "Las grasas trans", "las grasas totales"],
    ["sugar", "sugar_g", "carb_g", "Los azúcares", "los carbohidratos"],
  ] as const;
  for (const [field, code, parent, label, parentLabel] of parts) {
    const part = nutrients[code];
    const whole = nutrients[parent];
    if (
      part !== undefined &&
      whole !== undefined &&
      part > whole + 0.05 &&
      !errors[field]
    )
      errors[field] = `${label} no pueden superar ${parentLabel}.`;
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      name,
      brand: brand === "" ? null : brand,
      basis: base.success ? base.data.basis : "per_100g",
      portionSize,
      nutrients,
      kcalEstimated,
    },
  };
}
