/**
 * Porciones caseras de USDA (food_portion.csv) → public.food_portion (label_es, grams).
 *
 * Cada fuente describe la porción de forma distinta:
 * - FNDDS: `portion_description` ("1 cup", "1 medium", "Quantity not specified").
 * - SR Legacy: `amount` + `modifier` ("1" + "cup, chopped"); measure_unit = 9999.
 * - Foundation: `amount` + `measure_unit` ("1.0" + "cup") y a veces `modifier`.
 *
 * La etiqueta en inglés se traduce con reglas (diccionario de unidades y palabras
 * frecuentes); las palabras sin regla se conservan tal cual.
 */

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
 * Unidades y palabras frecuentes de las porciones. La clave es la palabra en
 * minúsculas; el valor es [singular, plural].
 */
const PORTION_WORDS: Record<string, [string, string]> = {
  cup: ["taza", "tazas"],
  cups: ["taza", "tazas"],
  tablespoon: ["cucharada", "cucharadas"],
  tablespoons: ["cucharada", "cucharadas"],
  tbsp: ["cucharada", "cucharadas"],
  teaspoon: ["cucharadita", "cucharaditas"],
  teaspoons: ["cucharadita", "cucharaditas"],
  tsp: ["cucharadita", "cucharaditas"],
  oz: ["onza", "onzas"],
  lb: ["libra", "libras"],
  pint: ["pinta", "pintas"],
  quart: ["cuarto de galón", "cuartos de galón"],
  gallon: ["galón", "galones"],
  liter: ["litro", "litros"],
  milliliter: ["mililitro", "mililitros"],
  slice: ["rebanada", "rebanadas"],
  slices: ["rebanada", "rebanadas"],
  piece: ["trozo", "trozos"],
  pieces: ["trozo", "trozos"],
  serving: ["porción", "porciones"],
  servings: ["porción", "porciones"],
  item: ["unidad", "unidades"],
  unit: ["unidad", "unidades"],
  each: ["unidad", "unidades"],
  whole: ["entero", "enteros"],
  can: ["lata", "latas"],
  bottle: ["botella", "botellas"],
  jar: ["frasco", "frascos"],
  package: ["paquete", "paquetes"],
  packet: ["sobre", "sobres"],
  pouch: ["bolsita", "bolsitas"],
  bag: ["bolsa", "bolsas"],
  box: ["caja", "cajas"],
  container: ["envase", "envases"],
  carton: ["caja", "cajas"],
  bar: ["barra", "barras"],
  stick: ["barra", "barras"],
  cookie: ["galleta", "galletas"],
  cracker: ["galleta", "galletas"],
  fillet: ["filete", "filetes"],
  filet: ["filete", "filetes"],
  steak: ["bistec", "bistecs"],
  chop: ["chuleta", "chuletas"],
  patty: ["hamburguesa", "hamburguesas"],
  patties: ["hamburguesa", "hamburguesas"],
  breast: ["pechuga", "pechugas"],
  drumstick: ["trutro corto", "trutros cortos"],
  thigh: ["trutro largo", "trutros largos"],
  wing: ["ala", "alas"],
  leg: ["pierna", "piernas"],
  egg: ["huevo", "huevos"],
  link: ["unidad", "unidades"],
  links: ["unidad", "unidades"],
  sausage: ["salchicha", "salchichas"],
  roll: ["pan", "panes"],
  bun: ["pan", "panes"],
  muffin: ["muffin", "muffins"],
  loaf: ["pan", "panes"],
  sandwich: ["sándwich", "sándwiches"],
  pizza: ["pizza", "pizzas"],
  pie: ["pie", "pies"],
  cake: ["torta", "tortas"],
  leaf: ["hoja", "hojas"],
  leaves: ["hoja", "hojas"],
  stalk: ["tallo", "tallos"],
  head: ["cabeza", "cabezas"],
  bunch: ["atado", "atados"],
  spear: ["tallo", "tallos"],
  wedge: ["gajo", "gajos"],
  fruit: ["fruta", "frutas"],
  scoop: ["bola", "bolas"],
  drink: ["bebida", "bebidas"],
  tortilla: ["tortilla", "tortillas"],
  taco: ["taco", "tacos"],
  burrito: ["burrito", "burritos"],
  nugget: ["nugget", "nuggets"],
  strip: ["tira", "tiras"],
  strips: ["tira", "tiras"],
  chip: ["unidad", "unidades"],
  chips: ["unidad", "unidades"],
  shrimp: ["camarón", "camarones"],
  olive: ["aceituna", "aceitunas"],
  tablet: ["tableta", "tabletas"],
  bowl: ["plato hondo", "platos hondos"],
  order: ["orden", "órdenes"],
  pancake: ["panqueque", "panqueques"],
  bagel: ["bagel", "bagels"],
  biscuit: ["biscuit", "biscuits"],
  doughnut: ["dona", "donas"],
  wrap: ["wrap", "wraps"],
  pocket: ["bolsillo", "bolsillos"],
  plantain: ["plátano", "plátanos"],
  banana: ["plátano", "plátanos"],
  onion: ["cebolla", "cebollas"],
  tomatoes: ["tomate", "tomates"],
  fish: ["pescado", "pescados"],
  roast: ["asado", "asados"],
};

/** Palabras sueltas (sin plural) y frases frecuentes en modificadores. */
const PORTION_PHRASES: [RegExp, string][] = [
  [/\bfl oz\b/gi, "onza líquida"],
  [/\bcubic inch(es)?\b/gi, "pulgada cúbica"],
  [/\bsurface inch(es)?\b/gi, "pulgada de superficie"],
  [/\bNLEA serving\b/gi, "porción NLEA"],
  [/\bRACC\b/g, "porción de referencia"],
  [/\bsingle serving\b/gi, "porción individual"],
  [/\bbite size\b/gi, "tamaño bocado"],
  [/\bno ice\b/gi, "sin hielo"],
  [/\bwith ice\b/gi, "con hielo"],
  [/\bwithout skin\b/gi, "sin piel"],
  [/\bwith skin\b/gi, "con piel"],
  [/\bwhole in shell\b/gi, "entero con cáscara"],
  [/\bwhole without shell\b/gi, "entero sin cáscara"],
  [/\bexcluding refuse\b/gi, "sin desechos"],
  [/\byield from\b/gi, "rinde de"],
  [/\btotal can contents\b/gi, "contenido total de la lata"],
  [/\bdrained solids\b/gi, "sólidos escurridos"],
  [/\bNFS\b/g, "sin especificar"],
  [/\bNS as to size\b/gi, "tamaño sin especificar"],
  [/\bready-to-cook\b/gi, "listo para cocinar"],
  [/\b(\w+)-size\b/gi, "tamaño $1"],
];

const PORTION_SINGLE_WORDS: Record<string, string> = {
  small: "pequeño",
  medium: "mediano",
  large: "grande",
  extra: "extra",
  regular: "normal",
  thin: "delgado",
  thick: "grueso",
  miniature: "miniatura",
  individual: "individual",
  chopped: "picado",
  diced: "en cubos",
  sliced: "en rodajas",
  shredded: "rallado",
  grated: "rallado",
  mashed: "molido",
  halves: "mitades",
  cubes: "cubos",
  cooked: "cocido",
  raw: "crudo",
  boneless: "sin hueso",
  peeled: "pelado",
  unpeeled: "sin pelar",
  edible: "parte comestible",
  white: "clara",
  yolk: "yema",
  with: "con",
  without: "sin",
  and: "y",
  or: "o",
  of: "de",
  from: "de",
  to: "para",
  per: "por",
  diameter: "de diámetro",
  long: "de largo",
  dia: "de diámetro",
  prepared: "preparado",
  packed: "compactado",
  pitted: "sin carozo",
  yields: "rinde",
  amount: "cantidad",
  make: "preparar",
  portion: "porción",
  personal: "personal",
  size: "tamaño",
  ready: "listo",
  heated: "calentado",
  crumbled: "desmenuzado",
  crumbles: "desmenuzado",
  ground: "molido",
  whole: "entero",
  cut: "cortado",
  pieces: "trozos",
  inch: "pulgada",
  inches: "pulgadas",
  calorie: "calorías",
  fluid: "líquido",
  any: "cualquier",
  very: "muy",
  crust: "masa",
  not: "no",
  eaten: "consumida",
  bread: "pan",
  meat: "carne",
  refuse: "desechos",
  dry: "seco",
  chicken: "pollo",
  submarine: "submarino",
  child: "niño",
  senior: "adulto mayor",
  school: "escolar",
  dipping: "para untar",
  sprout: "brote",
  tub: "pote",
  single: "individual",
  serving: "porción",
  bag: "bolsa",
  bun: "pan",
  snack: "snack",
  cookie: "galleta",
  pizza: "pizza",
  drink: "bebida",
  slice: "rebanada",
};

const SIZE_ADJECTIVES: Record<string, string> = {
  small: "unidad pequeña",
  medium: "unidad mediana",
  large: "unidad grande",
  "extra large": "unidad extra grande",
  regular: "unidad normal",
  miniature: "unidad miniatura",
};

function isOne(amount: string): boolean {
  const n = Number(amount);
  return n === 1 || amount === "1/2" || amount === "1/4" || amount === "1/3" || n < 1;
}

/** Palabras que pueden ir entre la cantidad y la unidad ("1 large or thick slice"). */
const PRE_UNIT_WORDS = new Set([
  "small",
  "medium",
  "large",
  "extra",
  "regular",
  "thin",
  "thick",
  "very",
  "or",
  "and",
  "miniature",
  "individual",
  "single",
  "serving",
  "personal",
  "size",
  "whole",
]);

function pluralSize(label: string): string {
  return label
    .replace("unidad", "unidades")
    .replace(/([ae])$/, "$1s")
    .replace(/l$/, "les");
}

/** Traduce una etiqueta de porción de USDA al español con reglas. */
export function translatePortionLabel(labelEn: string): string {
  const text = labelEn
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bextra[- ]large\b/gi, "extra large");

  const multi = text.match(
    /^(\d+(?:[./-]\d+)*)\s+(fl oz|cubic inch(?:es)?|surface inch(?:es)?)\b(.*)$/i,
  );
  if (multi) {
    const [, amount, unit, rest] = multi;
    const forms = MULTIWORD_UNITS[unit.toLowerCase().replace(/es$/, "")];
    return finish(
      `${amount} ${isOne(amount) ? forms[0] : forms[1]}${translateRest(rest)}`,
    );
  }

  // "1 large or thick slice" → "1 rebanada grande o grueso": la unidad va primero.
  const head = text.match(/^(\d+(?:[./-]\d+)*)\s+([A-Za-z ]+?)(\s*[,(/].*)?$/);
  if (head) {
    const [, amount, words, rest = ""] = head;
    const list = words.trim().split(" ");
    const unit = list[list.length - 1].toLowerCase();
    const before = list.slice(0, -1);
    const forms = PORTION_WORDS[unit];
    if (
      forms &&
      before.length > 0 &&
      before.every((w) => PRE_UNIT_WORDS.has(w.toLowerCase()))
    ) {
      const unitEs = isOne(amount) ? forms[0] : forms[1];
      return finish(
        `${amount} ${unitEs} ${translateRest(before.join(" "))}${translateRest(rest)}`,
      );
    }
  }

  // "1 medium" / "2 large" → "1 unidad mediana" (la porción es el alimento entero).
  const sizeOnly = text.match(
    /^(\d+(?:[./]\d+)?)\s+(extra large|small|medium|large|regular|miniature)\b(.*)$/i,
  );
  if (sizeOnly) {
    const [, amount, size, rest] = sizeOnly;
    const label = SIZE_ADJECTIVES[size.toLowerCase()];
    return finish(
      `${amount} ${isOne(amount) ? label : pluralSize(label)}${translateRest(rest)}`,
    );
  }

  const phrased = applyPhrases(text);
  // Cantidad inicial + unidad: concuerda el plural.
  const lead = phrased.match(/^(\d+(?:[./-]\d+)*)\s+([A-Za-z]+)\b(.*)$/);
  if (lead) {
    const [, amount, word, rest] = lead;
    const forms = PORTION_WORDS[word.toLowerCase()];
    if (forms) {
      const unit = isOne(amount) ? forms[0] : forms[1];
      return finish(`${amount} ${unit}${translateWords(rest)}`);
    }
  }
  return finish(translateWords(phrased));
}

const MULTIWORD_UNITS: Record<string, [string, string]> = {
  "fl oz": ["onza líquida", "onzas líquidas"],
  "cubic inch": ["pulgada cúbica", "pulgadas cúbicas"],
  "surface inch": ["pulgada de superficie", "pulgadas de superficie"],
};

function applyPhrases(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PORTION_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function translateRest(rest: string): string {
  return translateWords(applyPhrases(rest));
}

function translateWords(text: string): string {
  return text.replace(/\p{L}+/gu, (word) => {
    const lower = word.toLowerCase();
    if (lower in PORTION_SINGLE_WORDS) return PORTION_SINGLE_WORDS[lower];
    if (lower in PORTION_WORDS) return PORTION_WORDS[lower][0];
    return word;
  });
}

function finish(label: string): string {
  const clean = label.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  return clean.length > MAX_LABEL ? `${clean.slice(0, MAX_LABEL - 1).trimEnd()}…` : clean;
}

/**
 * Normaliza las porciones de un alimento: descarta las que no son caseras o no
 * tienen gramos válidos, traduce la etiqueta y elimina etiquetas repetidas
 * (se queda con la primera, en el orden de USDA).
 */
export function normalizePortions(rows: readonly UsdaPortionRow[]): NormalizedPortion[] {
  const result: NormalizedPortion[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const grams = Number(row.gramWeight);
    if (!Number.isFinite(grams) || grams <= 0 || grams >= 100000) continue;
    const labelEn = buildPortionLabelEn(row);
    if (!labelEn) continue;
    const labelEs = translatePortionLabel(labelEn);
    const key = labelEs.toLowerCase();
    if (!labelEs || seen.has(key)) continue;
    seen.add(key);
    result.push({
      sourcePortionId: row.id,
      labelEs,
      grams: Math.round(grams * 100) / 100,
    });
  }
  return result;
}
