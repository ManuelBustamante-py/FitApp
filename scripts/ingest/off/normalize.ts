/**
 * Normalización y validación de productos de Open Food Facts (OFF).
 *
 * Lógica pura: recibe un producto "crudo" (de una fila CSV/TSV o de una línea
 * JSONL) y decide si se importa, se ignora por país o se descarta con un motivo.
 * Los nutrientes de OFF vienen por 100 g (o 100 ml) en gramos; se convierten a las
 * unidades de public.nutrient (kcal, g, mg).
 */

/** Fuente en food.source y licencia en food.license (ver tabla data_source). */
export const OFF_SOURCE = "off";
export const OFF_LICENSE = "ODbL 1.0 (Open Food Facts)";
export const OFF_ATTRIBUTION =
  "Contiene información de Open Food Facts, disponible bajo la Open Database License (ODbL).";

/** País principal. */
export const CHILE_TAG = "en:chile";

/** Países latinoamericanos para --latam (etiquetas countries_tags de OFF). */
export const LATAM_COUNTRY_TAGS: readonly string[] = [
  "en:chile",
  "en:argentina",
  "en:bolivia",
  "en:brazil",
  "en:colombia",
  "en:costa-rica",
  "en:cuba",
  "en:dominican-republic",
  "en:ecuador",
  "en:el-salvador",
  "en:guatemala",
  "en:honduras",
  "en:mexico",
  "en:nicaragua",
  "en:panama",
  "en:paraguay",
  "en:peru",
  "en:uruguay",
  "en:venezuela",
];

/** Límites de validación. */
export const MAX_KCAL_100G = 900;
export const MAX_GRAMS_100G = 100;
/** Proteínas + grasas + carbohidratos pueden exceder 100 g por redondeo de etiqueta. */
export const MAX_MACRO_SUM = 105;
const KJ_PER_KCAL = 4.184;
const MAX_NAME_LENGTH = 200;
const BARCODE_RE = /^[0-9]{6,14}$/;

/** Producto leído del archivo, ya con tipos básicos. NaN = valor presente pero no numérico. */
export interface OffRawProduct {
  code: string;
  productName: string;
  productNameEs: string;
  brands: string;
  quantity: string;
  countriesTags: string[];
  /** Claves de OFF: "energy-kcal_100g", "proteins_100g"… */
  nutriments: Record<string, number | undefined>;
}

export interface OffFood {
  barcode: string;
  nameEs: string;
  brand: string | null;
  basis: "per_100g" | "per_100ml";
  /** Código de public.nutrient → cantidad por 100 g/ml (kcal, g o mg). */
  nutrients: Record<string, number>;
  /** true si las kcal salieron de kJ ÷ 4,184. */
  kcalDesdeKj: boolean;
}

export type InvalidReason =
  | "sin_codigo_barras"
  | "sin_nombre"
  | "sin_energia"
  | "kcal_fuera_de_rango"
  | "valor_no_numerico"
  | "nutriente_fuera_de_rango"
  | "macros_suman_mas_de_100";

export type ProcessResult =
  | { kind: "ok"; food: OffFood }
  | { kind: "fuera_de_pais" }
  | { kind: "invalido"; reason: InvalidReason; detail: string };

export interface ProcessOptions {
  /** Etiquetas de país aceptadas (por defecto solo Chile). */
  countries: ReadonlySet<string>;
}

export function parseNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return raw;
  const text = String(raw).trim();
  if (text === "") return undefined;
  return Number(text.replace(",", "."));
}

export function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Primera marca de la lista separada por comas de OFF. */
function firstBrand(brands: string): string | null {
  const first = brands.split(",")[0]?.trim();
  return first ? first : null;
}

function isLiquid(quantity: string): boolean {
  return /\d\s*(ml|cl|dl|l|lt|lts|litros?)\b/i.test(quantity.trim());
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Rango 0..100 g; devuelve el mensaje de error o null si es válido o falta. */
function gramsError(value: number | undefined, label: string): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > MAX_GRAMS_100G) {
    return `${label} ${value} g por 100 g (rango 0 a ${MAX_GRAMS_100G})`;
  }
  return null;
}

/** Nutrientes en gramos por 100 g: clave de OFF, código de public.nutrient, etiqueta y factor. */
const GRAM_FIELDS: readonly {
  key: string;
  code: string;
  label: string;
  factor: number;
}[] = [
  { key: "proteins_100g", code: "protein_g", label: "proteínas", factor: 1 },
  { key: "fat_100g", code: "fat_g", label: "grasas", factor: 1 },
  { key: "carbohydrates_100g", code: "carb_g", label: "carbohidratos", factor: 1 },
  { key: "sugars_100g", code: "sugar_g", label: "azúcares", factor: 1 },
  { key: "fiber_100g", code: "fiber_g", label: "fibra", factor: 1 },
  {
    key: "saturated-fat_100g",
    code: "fat_saturated_g",
    label: "grasas saturadas",
    factor: 1,
  },
  { key: "trans-fat_100g", code: "fat_trans_g", label: "grasas trans", factor: 1 },
  { key: "alcohol_100g", code: "alcohol_g", label: "alcohol", factor: 1 },
  // OFF informa colesterol y sodio en g; public.nutrient los guarda en mg.
  { key: "cholesterol_100g", code: "cholesterol_mg", label: "colesterol", factor: 1000 },
  { key: "sodium_100g", code: "sodium_mg", label: "sodio", factor: 1000 },
];

export function processProduct(
  raw: OffRawProduct,
  options: ProcessOptions,
): ProcessResult {
  if (!raw.countriesTags.some((tag) => options.countries.has(tag))) {
    return { kind: "fuera_de_pais" };
  }
  const invalid = (reason: InvalidReason, detail: string): ProcessResult => ({
    kind: "invalido",
    reason,
    detail,
  });

  const barcode = raw.code.trim();
  if (!BARCODE_RE.test(barcode)) {
    return invalid("sin_codigo_barras", `código "${raw.code}"`);
  }
  const name = (raw.productNameEs.trim() || raw.productName.trim()).replace(/\s+/g, " ");
  if (name === "") return invalid("sin_nombre", "product_name_es y product_name vacíos");

  const n = raw.nutriments;
  for (const [key, value] of Object.entries(n)) {
    if (value !== undefined && Number.isNaN(value)) {
      return invalid("valor_no_numerico", `${key} no es un número`);
    }
  }

  // Energía: kcal directas o kJ ÷ 4,184 (el export CSV llama "energy_100g" a los kJ).
  let kcal = n["energy-kcal_100g"];
  let kcalDesdeKj = false;
  if (kcal === undefined) {
    const kj = n["energy-kj_100g"] ?? n["energy_100g"];
    if (kj !== undefined) {
      kcal = round(kj / KJ_PER_KCAL, 1);
      kcalDesdeKj = true;
    }
  }
  if (kcal === undefined) return invalid("sin_energia", "sin kcal ni kJ por 100 g");
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > MAX_KCAL_100G) {
    return invalid(
      "kcal_fuera_de_rango",
      `${kcal} kcal por 100 g (rango 0 a ${MAX_KCAL_100G})`,
    );
  }

  const nutrients: Record<string, number> = { energy_kcal: round(kcal, 1) };
  for (const { key, code, label, factor } of GRAM_FIELDS) {
    const value = n[key];
    const error = gramsError(value, label);
    if (error) return invalid("nutriente_fuera_de_rango", error);
    if (value !== undefined) nutrients[code] = round(value * factor, 3);
  }

  // Sal (g) → sodio (mg) cuando OFF no informa sodio: sodio = sal ÷ 2,5.
  const salt = n["salt_100g"];
  const saltError = gramsError(salt, "sal");
  if (saltError) return invalid("nutriente_fuera_de_rango", saltError);
  if (nutrients.sodium_mg === undefined && salt !== undefined) {
    nutrients.sodium_mg = round(salt * 400, 1);
  }

  const macroSum =
    (nutrients.protein_g ?? 0) + (nutrients.fat_g ?? 0) + (nutrients.carb_g ?? 0);
  if (macroSum > MAX_MACRO_SUM) {
    return invalid(
      "macros_suman_mas_de_100",
      `proteínas + grasas + carbohidratos = ${round(macroSum, 1)} g por 100 g (máx. ${MAX_MACRO_SUM})`,
    );
  }

  return {
    kind: "ok",
    food: {
      barcode,
      nameEs: name.slice(0, MAX_NAME_LENGTH),
      brand: firstBrand(raw.brands),
      basis: isLiquid(raw.quantity) ? "per_100ml" : "per_100g",
      nutrients,
      kcalDesdeKj,
    },
  };
}
