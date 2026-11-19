/**
 * Porciones caseras de USDA (food_portion.csv) → public.food_portion (label_es, grams).
 *
 * Cada fuente describe la porción de forma distinta:
 * - FNDDS: `portion_description` ("1 cup", "1 medium", "Quantity not specified").
 * - SR Legacy: `amount` + `modifier` ("1" + "cup, chopped"); measure_unit = 9999.
 * - Foundation: `amount` + `measure_unit` ("1.0" + "cup") y a veces `modifier`.
 *
 * La etiqueta en inglés se traduce con el glosario de alimentos más el de porciones
 * (glossary-porciones.ts). Una etiqueta solo se importa si queda totalmente en español:
 * las que conservan palabras sin traducir se descartan y se informan en el reporte.
 * Los nombres de marca (palabras con inicial mayúscula) se dejan tal cual.
 */

import { SUSTANTIVOS } from "./glossary.ts";
import {
  PORCION_MODIFICADORES,
  PORCION_NEXOS,
  PORCION_SUSTANTIVOS,
} from "./glossary-porciones.ts";
import {
  agreementOf,
  translateFragment,
  type Agreement,
  type Overlay,
} from "./translate.ts";

export interface UsdaPortionRow {
  /** food_portion.id de USDA (estable dentro de la publicación). */
  id: string;
  amount: string;
  measureUnitName: string;
  portionDescription: string;
  modifier: string;
  gramWeight: string;
  /** Orden de la porción en USDA (puede venir vacío). */
  seqNum?: string;
}

export interface NormalizedPortion {
  sourcePortionId: string;
  labelEs: string;
  grams: number;
}

/** Unidades de medida de Foundation que no son porciones caseras (pesos apareados). */
const NON_HOUSEHOLD_UNITS = new Set([
  "paired cooked w",
  "paired raw w",
  "dripping w",
  "orig ckd g",
  "orig rw g",
]);

const MAX_LABEL = 80;

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 1000) / 1000);
}

/** Etiqueta en inglés tal como la describe USDA; null si no es una porción casera. */
export function buildPortionLabelEn(row: UsdaPortionRow): string | null {
  const description = row.portionDescription.trim();
  const modifier = row.modifier.trim();
  const unit = row.measureUnitName.trim();
  if (description) {
    if (/^(quantity not specified|guideline amount)/i.test(description)) return null;
    return description;
  }
  if (NON_HOUSEHOLD_UNITS.has(unit.toLowerCase())) return null;
  const amount = formatAmount(row.amount) || "1";
  // En FNDDS `modifier` es un código numérico, no texto.
  const textModifier = /^\d+$/.test(modifier) ? "" : modifier;
  const unitText = unit && unit.toLowerCase() !== "undetermined" ? unit : "";
  const parts = [unitText, textModifier].filter(Boolean);
  if (parts.length === 0) return null;
  return `${amount} ${parts.join(", ")}`;
}

/**
 * Unidades de medida: la clave es cada forma inglesa (minúsculas) y el valor
 * [singular, plural] en español. Se pluralizan por la cantidad que las precede
 * ("2 tbsp" → "2 cucharadas") o por la forma inglesa ("cups").
 */
const MEDIDAS: Record<string, [string, string]> = {
  "fl oz": ["onza líquida", "onzas líquidas"],
  "fl. oz": ["onza líquida", "onzas líquidas"],
  "fluid ounce": ["onza líquida", "onzas líquidas"],
  "fluid ounces": ["onza líquida", "onzas líquidas"],
  "cubic inch": ["pulgada cúbica", "pulgadas cúbicas"],
  "cubic inches": ["pulgada cúbica", "pulgadas cúbicas"],
  "surface inch": ["pulgada de superficie", "pulgadas de superficie"],
  "surface inches": ["pulgada de superficie", "pulgadas de superficie"],
  oz: ["onza", "onzas"],
  ounce: ["onza", "onzas"],
  ounces: ["onza", "onzas"],
  lb: ["libra", "libras"],
  lbs: ["libra", "libras"],
  pound: ["libra", "libras"],
  pounds: ["libra", "libras"],
  g: ["g", "g"],
  gram: ["g", "g"],
  grams: ["g", "g"],
  kg: ["kg", "kg"],
  mg: ["mg", "mg"],
  ml: ["ml", "ml"],
  milliliter: ["ml", "ml"],
  milliliters: ["ml", "ml"],
  liter: ["litro", "litros"],
  liters: ["litro", "litros"],
  cup: ["taza", "tazas"],
  cups: ["taza", "tazas"],
  tbsp: ["cucharada", "cucharadas"],
  tbs: ["cucharada", "cucharadas"],
  tablespoon: ["cucharada", "cucharadas"],
  tablespoons: ["cucharada", "cucharadas"],
  tsp: ["cucharadita", "cucharaditas"],
  teaspoon: ["cucharadita", "cucharaditas"],
  teaspoons: ["cucharadita", "cucharaditas"],
  pint: ["pinta", "pintas"],
  pints: ["pinta", "pintas"],
  quart: ["cuarto de galón", "cuartos de galón"],
  quarts: ["cuarto de galón", "cuartos de galón"],
  gallon: ["galón", "galones"],
  gallons: ["galón", "galones"],
  inch: ["pulgada", "pulgadas"],
  inches: ["pulgada", "pulgadas"],
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?(?:[- ]\d+\/\d+|\/\d+)?`;
const UNIT_ALTERNATIVES = Object.keys(MEDIDAS)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.]/g, String.raw`\.`).replace(/ /g, String.raw`\s+`))
  .join("|");
/** "12 oz", "1-1/2 cups", "209g", "4 fl oz": cantidad + unidad de medida. */
const MEASURE = new RegExp(
  `(${NUMBER}(?:\\s*-\\s*${NUMBER})?)\\s*((?:heaping|level|rounded|scant|generous)\\s+)?(${UNIT_ALTERNATIVES})(?![a-z])`,
  "gi",
);

const PLURAL_EN = new Set([
  "cups",
  "tablespoons",
  "teaspoons",
  "ounces",
  "fluid ounces",
  "pounds",
  "lbs",
  "grams",
  "milliliters",
  "liters",
  "pints",
  "quarts",
  "gallons",
  "inches",
  "cubic inches",
  "surface inches",
]);

function amountValue(raw: string): number {
  const nums = raw.split(/\s*-\s*(?=\d)/).pop() ?? raw;
  return nums.split(/[\s-]+/).reduce((sum, part) => {
    const m = part.match(/^(\d+)\/(\d+)$/);
    if (m) return sum + Number(m[1]) / Number(m[2]);
    const n = Number(part.replace(",", "."));
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}

/**
 * Nombres de marca y productos: una racha de dos o más palabras con inicial
 * mayúscula que no abre la etiqueta ni una frase entre paréntesis ("Earth's Best",
 * "Taco Bell", "Fiber One Muffin") se conserva tal cual. Se reemplaza por un marcador
 * mientras se traduce el resto. Las palabras sueltas con inicial mayúscula o en
 * mayúsculas se conservan solo si no están en el glosario.
 */
function extractBrands(label: string): {
  text: string;
  brands: Record<string, string>;
  proper: Set<string>;
} {
  const brands: Record<string, string> = {};
  const proper = new Set<string>();
  let n = 0;
  const text = label.replace(
    /(^|[(]\s*|[^A-Za-z'’(])((?:[A-Z][A-Za-z'’!&.-]*)(?:\s+[A-Z][A-Za-z'’!&.-]*)*)/g,
    (whole: string, before: string, run: string, offset: number) => {
      const opens = offset === 0 && before === "" ? true : before.includes("(");
      const words = run.split(/\s+/);
      const rest = opens ? words.slice(1) : words;
      const head = opens ? words[0] : "";
      if (rest.length >= 2 && !rest.every((w) => /^[A-Z]{2,}$/.test(w))) {
        const key = `qxbrand${String.fromCharCode(97 + n++)}qx`;
        brands[key] = rest.join(" ");
        return `${before}${head}${head ? " " : ""}${key}`;
      }
      for (const w of rest) proper.add(w.toLowerCase());
      return whole;
    },
  );
  for (const w of label.match(/\b[A-Z]{2,}\b/g) ?? []) proper.add(w.toLowerCase());
  return { text, brands, proper };
}

const PORCION_OVERLAY: Overlay = {
  nouns: PORCION_SUSTANTIVOS,
  mods: PORCION_MODIFICADORES,
  seps: PORCION_NEXOS,
};

export interface PortionTranslation {
  text: string;
  /** Palabras sin traducción (vacío si la etiqueta quedó totalmente en español). */
  missing: string[];
}

function pluralizeEnglish(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Traduce una etiqueta de porción de USDA al español (Chile) con el glosario. */
export function translatePortion(labelEn: string): PortionTranslation {
  const cleaned = labelEn
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
  const { text: marked, brands, proper } = extractBrands(cleaned);
  const overlay: Overlay = { ...PORCION_OVERLAY, seps: { ...PORCION_NEXOS, ...brands } };
  const text = marked
    .toLowerCase()
    .replace(/\bextra[- ]large\b/g, "extra large")
    .replace(/\bns as to (\w+)/g, "$1 nfs")
    // Dimensiones: '2" long' → "2" de largo" (los marcadores se traducen con PORCION_NEXOS).
    .replace(/\b(dia|diameter)\b\.?/g, "qxdia")
    .replace(
      /(\d"|\d\s*(?:inch|inches|cm|mm))\s+(long|thick|high|wide|deep|tall)\b/g,
      (_m, d: string, word: string) => `${d} qx${word}`,
    )
    // "1 large or thick slice" → "1 slice large or thick" (los adjetivos van después en español).
    .replace(
      /^(\d+(?:[./-]\d+)*)\s+((?:[a-z]+)(?:\s+(?:or|and)\s+[a-z]+)+)\s+([a-z]+)\b/,
      (m, n: string, adjs: string, noun: string) =>
        isNoun(noun) &&
        adjs.split(/\s+(?:or|and)\s+/).every((a) => a in PORCION_MODIFICADORES)
          ? `${n} ${noun} ${adjs}`
          : m,
    )
    // "1 medium" = una unidad mediana.
    .replace(
      /^(\d+(?:[./-]\d+)*)\s+((?:extra large|small|medium|large|regular|miniature|jumbo|mini)(?: or (?:extra large|small|medium|large))?)(?=\s*(?:[(,]|$))/,
      "$1 unit $2",
    );

  const missing: string[] = [];
  const out: string[] = [];
  let agr: Agreement | undefined;
  let last = 0;
  let pending = "";
  const fragment = (rawChunk: string) => {
    const chunk = pending + rawChunk;
    pending = "";
    // Un sustantivo en singular precedido de una cantidad mayor que 1 va en plural.
    const fixed = chunk.replace(
      /(?<![\d.,/-])(\d+(?:[.,]\d+)?(?:[- ]\d+\/\d+|\/\d+)?)\s+([a-z]+)\b/g,
      (m, n: string, word: string) =>
        amountValue(n) > 1 && !word.endsWith("s") && isNoun(word)
          ? `${n} ${pluralizeEnglish(word)}`
          : m,
    );
    const result = translateFragment(fixed, { overlay, proper, agr });
    missing.push(...result.missing);
    if (result.text) out.push(result.text);
  };
  for (const match of text.matchAll(MEASURE)) {
    const index = match.index ?? 0;
    fragment(text.slice(last, index));
    pending = "";
    const unitKey = match[3].toLowerCase().replace(/\s+/g, " ");
    const forms = MEDIDAS[unitKey];
    const plural = amountValue(match[1]) > 1 || PLURAL_EN.has(unitKey);
    const unit = plural ? forms[1] : forms[0];
    out.push(`${match[1].replace(/\s*-\s*/g, "-")} ${unit}`);
    agr = agreementOf(unit);
    pending = match[2] ?? "";
    last = index + match[0].length;
  }
  fragment(text.slice(last));
  const joined = out
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/(\d)\s+"/g, '$1"')
    .replace(/(\d")(?=[A-Za-zÁ-ú(])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: joined, missing };
}

function isNoun(word: string): boolean {
  return word in PORCION_SUSTANTIVOS || word in SUSTANTIVOS;
}

/** Traduce una etiqueta de porción; las palabras sin traducción quedan tal cual. */
export function translatePortionLabel(labelEn: string): string {
  return translatePortion(labelEn).text;
}

/** Si la etiqueta supera el máximo de la base, quita los paréntesis finales (aclaraciones) hasta que quepa. */
function shorten(label: string): string {
  let text = label;
  while (text.length > MAX_LABEL && /\s*\([^()]*\)\s*$/.test(text)) {
    text = text.replace(/\s*\([^()]*\)\s*$/, "");
  }
  return text;
}

export interface NormalizedPortions {
  portions: NormalizedPortion[];
  /** Etiquetas en inglés descartadas por no poder traducirse por completo. */
  untranslated: string[];
}

/**
 * Normaliza las porciones de un alimento: descarta las que no son caseras o no
 * tienen gramos válidos y traduce la etiqueta. Las etiquetas que no quedan
 * totalmente en español (o superan el largo máximo) se descartan y se informan en
 * `untranslated`. Las etiquetas repetidas se eliminan (queda la primera, en el
 * orden de USDA).
 */
export function normalizePortions(rows: readonly UsdaPortionRow[]): NormalizedPortions {
  const portions: NormalizedPortion[] = [];
  const untranslated: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const grams = Number(row.gramWeight);
    if (!Number.isFinite(grams) || grams <= 0 || grams >= 100000) continue;
    const labelEn = buildPortionLabelEn(row);
    if (!labelEn) continue;
    const translated = translatePortion(labelEn);
    const { missing } = translated;
    const text = shorten(translated.text);
    if (missing.length > 0 || text === "" || text.length > MAX_LABEL) {
      untranslated.push(labelEn);
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    portions.push({
      sourcePortionId: row.id,
      labelEs: text,
      grams: Math.round(grams * 100) / 100,
    });
  }
  return { portions, untranslated };
}
