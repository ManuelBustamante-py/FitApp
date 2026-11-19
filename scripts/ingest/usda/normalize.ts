/**
 * Normalización de un alimento USDA a las filas de public.food / food_nutrient /
 * food_portion (lógica pura, sin E/S).
 */

import { mapNutrients, type UsdaNutrientValue } from "./nutrients.ts";
import {
  normalizePortions,
  type NormalizedPortion,
  type UsdaPortionRow,
} from "./portions.ts";

export const USDA_LICENSE = "CC0 / dominio público";

/** Tipos de dato de FDC que se importan y su `source` en public.food. */
export const DATA_TYPE_SOURCE: Readonly<Record<string, UsdaSource>> = {
  foundation_food: "usda_fdc",
  sr_legacy_food: "usda_fdc",
  survey_fndds_food: "usda_fndds",
};

export type UsdaSource = "usda_fdc" | "usda_fndds";

export function sourceForDataType(dataType: string): UsdaSource | null {
  return DATA_TYPE_SOURCE[dataType] ?? null;
}

const COOKED =
  /\b(cooked|boiled|roasted|baked|fried|pan-fried|deep-fried|grilled|broiled|pan-broiled|braised|stewed|steamed|simmered|sauteed|sautéed|poached|scrambled|microwaved|toasted|rotisserie|barbecued|smoked)\b/i;
const RAW = /\b(raw|uncooked)\b/i;

/**
 * Estado del alimento a partir del nombre en inglés, solo cuando es evidente.
 * La cocción gana sobre "raw" porque FNDDS usa "cooked, from raw".
 */
export function detectState(nameEn: string): "crudo" | "cocido" | "na" {
  if (COOKED.test(nameEn)) return "cocido";
  if (RAW.test(nameEn)) return "crudo";
  return "na";
}

/** Categorías de FDC (food_category.csv de Foundation y SR Legacy) en español. */
const CATEGORY_ES: Record<string, string> = {
  "Dairy and Egg Products": "Lácteos y huevos",
  "Spices and Herbs": "Especias y hierbas",
  "Baby Foods": "Alimentos infantiles",
  "Fats and Oils": "Grasas y aceites",
  "Poultry Products": "Aves",
  "Soups, Sauces, and Gravies": "Sopas y salsas",
  "Sausages and Luncheon Meats": "Embutidos y fiambres",
  "Breakfast Cereals": "Cereales de desayuno",
  "Fruits and Fruit Juices": "Frutas y jugos de fruta",
  "Pork Products": "Cerdo",
  "Vegetables and Vegetable Products": "Verduras",
  "Nut and Seed Products": "Frutos secos y semillas",
  "Beef Products": "Vacuno",
  Beverages: "Bebidas",
  "Finfish and Shellfish Products": "Pescados y mariscos",
  "Legumes and Legume Products": "Legumbres",
  "Lamb, Veal, and Game Products": "Cordero, ternera y caza",
  "Baked Products": "Panadería y pastelería",
  Sweets: "Dulces",
  "Cereal Grains and Pasta": "Cereales y pastas",
  "Fast Foods": "Comida rápida",
  "Meals, Entrees, and Side Dishes": "Platos preparados",
  Snacks: "Snacks",
  "American Indian/Alaska Native Foods": "Alimentos nativos americanos",
  "Restaurant Foods": "Comida de restaurante",
  "Branded Food Products Database": "Productos de marca",
  "Quality Control Materials": "Materiales de control",
  "Alcoholic Beverages": "Bebidas alcohólicas",
};

/**
 * Categoría en español. Las categorías WWEIA de FNDDS (unas 170) se dejan en
 * inglés hasta tener su traducción revisada.
 */
export function categoryEs(categoryEn: string | null | undefined): string | null {
  const value = categoryEn?.trim();
  if (!value) return null;
  return CATEGORY_ES[value] ?? value;
}

/** Valida rangos plausibles por 100 g; devuelve el motivo si no pasa. */
export function validateNutrients(nutrients: Record<string, number>): string | null {
  const kcal = nutrients.energy_kcal;
  if (kcal === undefined) return "sin energía (kcal)";
  if (kcal > 902) return `energía imposible: ${kcal} kcal/100 g`;
  for (const code of [
    "protein_g",
    "carb_g",
    "fat_g",
    "sugar_g",
    "fiber_g",
    "alcohol_g",
  ]) {
    const value = nutrients[code];
    if (value !== undefined && value > 100) return `${code} > 100 g/100 g (${value})`;
  }
  const macros =
    (nutrients.protein_g ?? 0) + (nutrients.carb_g ?? 0) + (nutrients.fat_g ?? 0);
  if (macros > 105) return `proteínas + carbohidratos + grasas = ${macros} g/100 g`;
  if (nutrients.sodium_mg !== undefined && nutrients.sodium_mg > 40000) {
    return `sodio imposible: ${nutrients.sodium_mg} mg/100 g`;
  }
  return null;
}

/** Alimento USDA leído de los CSV (antes de traducir). */
export interface UsdaFood {
  fdcId: string;
  dataType: string;
  description: string;
  categoryEn: string | null;
  nutrients: UsdaNutrientValue[];
  portions: UsdaPortionRow[];
}

export interface NormalizedFood {
  source: UsdaSource;
  sourceId: string;
  nameEs: string;
  nameEn: string;
  category: string | null;
  state: "crudo" | "cocido" | "na";
  basis: "per_100g";
  license: string;
  /** Código de nutriente FitApp → cantidad por 100 g. */
  nutrients: Record<string, number>;
  portions: NormalizedPortion[];
}

export type NormalizeResult =
  | { ok: true; food: NormalizedFood }
  | { ok: false; kind: "omitido" | "error"; reason: string };

/**
 * Convierte un alimento USDA ya traducido. USDA informa todos los nutrientes por
 * 100 g de porción comestible (también las bebidas), por eso basis = per_100g.
 */
export function normalizeFood(food: UsdaFood, nameEs: string): NormalizeResult {
  const source = sourceForDataType(food.dataType);
  if (!source) {
    return {
      ok: false,
      kind: "error",
      reason: `tipo de dato no soportado: ${food.dataType}`,
    };
  }
  const name = nameEs.trim();
  if (name.length < 1 || name.length > 200) {
    return {
      ok: false,
      kind: "error",
      reason: "name_es debe tener entre 1 y 200 caracteres",
    };
  }
  const nutrients = mapNutrients(food.nutrients);
  // Sin energía el alimento no sirve para el balance: se omite (no es un error de datos).
  if (nutrients.energy_kcal === undefined) {
    return { ok: false, kind: "omitido", reason: "sin_energia" };
  }
  const invalid = validateNutrients(nutrients);
  if (invalid) return { ok: false, kind: "error", reason: invalid };
  return {
    ok: true,
    food: {
      source,
      sourceId: food.fdcId,
      nameEs: name,
      nameEn: food.description.trim(),
      category: categoryEs(food.categoryEn),
      state: detectState(food.description),
      basis: "per_100g",
      license: USDA_LICENSE,
      nutrients,
      portions: normalizePortions(food.portions),
    },
  };
}
