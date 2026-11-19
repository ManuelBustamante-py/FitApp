/**
 * Traducción determinista (borrador) de nombres USDA al español.
 *
 * Reglas:
 * 1. El nombre se divide en segmentos por comas ("Chicken, broiler, breast, raw").
 *    Se respeta el orden de los segmentos, que en USDA va de lo general a lo
 *    específico, igual que se lee bien en español ("Pollo, pechuga, crudo").
 * 2. Cada segmento se busca completo en SEGMENTOS / PATRONES_SEGMENTO.
 * 3. Si no, se traduce por frases y palabras (gana la frase más larga). Dentro de
 *    un grupo de palabras sin nexos, el orden inglés (modificadores + núcleo) se
 *    invierte: núcleo primero, sustantivos con "de" y adjetivos después
 *    ("chicken breast" → "pechuga de pollo", "brown rice" → "arroz integral").
 * 4. Si alguna palabra no está en el glosario, la traducción queda incompleta: la
 *    palabra se marca entre corchetes y el nombre no se propone como name_es.
 */

import {
  GENERICOS,
  GENERO_ESPECIAL,
  MARCAS,
  MODIFICADORES,
  NEXOS,
  NOMBRES,
  PATRONES_SEGMENTO,
  SEGMENTOS,
  SINGULARES_EN_S,
  SUSTANTIVOS,
} from "./glossary.ts";

export interface NameTranslation {
  /** Traducción; las palabras sin traducir aparecen como [word]. */
  text: string;
  /** true si todas las palabras se tradujeron. */
  complete: boolean;
  /** Palabras sin traducción, en orden de aparición. */
  missing: string[];
}

/** Tablas adicionales que tienen prioridad sobre el glosario (p. ej. el de porciones). */
export interface Overlay {
  nouns?: Readonly<Record<string, string>>;
  mods?: Readonly<Record<string, string>>;
  seps?: Readonly<Record<string, string>>;
}

export interface Agreement {
  gender: "m" | "f";
  plural: boolean;
}

type Unit =
  | { kind: "noun"; text: string; key: string; agr: Agreement }
  | { kind: "mod"; text: string }
  | { kind: "sep"; text: string };

const MAX_PHRASE_WORDS = 5;
const WORD = /^[a-z][a-z'’]*(?:-[a-z][a-z'’]*)*$/;

/** Divide por comas que no estén dentro de paréntesis. */
export function splitSegments(name: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of name) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments.map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
}

function tokenize(
  segment: string,
  overlay?: Overlay,
  proper?: ReadonlySet<string>,
): string[] {
  const raw =
    segment.match(
      /w\/o|w\/|[a-z][a-z'’]*(?:-[a-z][a-z'’]*)*|\d+(?:[.,/-]\d+)*%?|[^\sa-z\d]/g,
    ) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    // Palabras con guion que no están en el glosario se separan en sus partes.
    if (
      token.includes("-") &&
      WORD.test(token) &&
      !lookup(token, overlay) &&
      !proper?.has(token)
    ) {
      tokens.push(...token.split("-"));
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

const GENERO_PALABRAS_F = new Set([
  "leche",
  "carne",
  "sangre",
  "ave",
  "base",
  "clase",
  "fuente",
  "especie",
  "sal",
  "miel",
  "piel",
  "col",
  "coliflor",
  "flor",
  "nuez",
  "raíz",
  "luz",
  "cruz",
  "paz",
  "vez",
  "mano",
  "sartén",
  "madre",
  "noche",
  "gente",
  "ensalada",
]);

const GENERO_PALABRAS_M = new Set([
  "día",
  "mapa",
  "té",
  "café",
  "maní",
  "ají",
  "puré",
  "jamón",
  "arroz",
  "pan",
  "aceite",
  "tomate",
  "paté",
  "bebé",
  "menú",
  "brócoli",
  "ñame",
  "maíz",
  "azúcar",
  "vinagre",
  "colesterol",
  "agave",
  "germen",
  "salvado",
  "almidón",
  "jarabe",
  "chile",
  "coco",
  "mate",
  "pie",
  "lomo",
  "yogur",
  "cereal",
  "pimiento",
  "polvo",
]);

/** Formas singulares candidatas de una palabra española (para buscar en las listas). */
function singularCandidates(word: string): string[] {
  const candidates = [word];
  if (word.endsWith("s")) candidates.push(word.slice(0, -1));
  if (word.endsWith("es")) candidates.push(word.slice(0, -2));
  if (word.endsWith("ces")) candidates.push(`${word.slice(0, -3)}z`);
  if (word.endsWith("ones")) candidates.push(`${word.slice(0, -4)}ón`);
  if (word.endsWith("iones")) candidates.push(`${word.slice(0, -5)}ión`);
  return candidates;
}

/** Género y número de un sustantivo español (por su primera palabra, que es el núcleo). */
export function agreementOf(spanish: string): Agreement {
  const word = (spanish.toLowerCase().match(/[a-záéíóúüñ]+/) ?? [""])[0];
  const plural = word.length > 3 && word.endsWith("s") && !SINGULARES_EN_S.has(word);
  const candidates = plural ? singularCandidates(word) : [word];
  for (const c of candidates) {
    if (c in GENERO_ESPECIAL) return { gender: GENERO_ESPECIAL[c], plural };
    if (GENERO_PALABRAS_F.has(c)) return { gender: "f", plural };
    if (GENERO_PALABRAS_M.has(c)) return { gender: "m", plural };
  }
  const base = candidates[plural ? Math.min(1, candidates.length - 1) : 0];
  if (/(ción|sión|xión|gión|dad|tad|tud|umbre)$/.test(base))
    return { gender: "f", plural };
  if (/a$/.test(base)) return { gender: "f", plural };
  return { gender: "m", plural };
}

/** Palabras iniciales de complementos o frases que no se flexionan. */
const INVARIABLE_INICIAL = new Set([
  "en",
  "con",
  "sin",
  "de",
  "del",
  "a",
  "al",
  "para",
  "por",
  "como",
  "tipo",
  "estilo",
  "sabor",
  "según",
  "no",
  "más",
  "menos",
  "libre",
  "solo",
  "y",
  "o",
  "calor",
  "extra",
  "modo",
  "cualquier",
  "cero",
  "método",
  "forma",
]);

/** Pluraliza un adjetivo español (invariable si termina en consonante extranjera). */
function pluralizeAdjective(word: string): string {
  if (/és$/.test(word)) return `${word.slice(0, -2)}eses`;
  if (/[aeiouáéíóú]$/.test(word)) return `${word}s`;
  if (/z$/.test(word)) return `${word.slice(0, -1)}ces`;
  if (/[lrndj]$/.test(word)) return `${word}es`;
  return word;
}

/** Concuerda una palabra adjetiva (el glosario la guarda en masculino singular). */
function inflectWord(word: string, agr: Agreement): string {
  let result = word;
  if (agr.gender === "f") {
    if (/o$/.test(result) && result.length > 3) result = `${result.slice(0, -1)}a`;
    else if (/dor$/.test(result) && result.length > 4) result = `${result}a`;
    else if (/és$/.test(result) && result.length > 4)
      result = `${result.slice(0, -2)}esa`;
  }
  if (agr.plural) result = pluralizeAdjective(result);
  return result;
}

/**
 * Concuerda un modificador con su núcleo. Solo se flexiona la primera palabra
 * ("bajo en grasa" → "baja en grasa"); los complementos con preposición y las
 * frases que no empiezan por un adjetivo se dejan igual.
 */
export function inflectAdjective(text: string, agr: Agreement): string {
  if (!/^[a-záéíóúüñ]/.test(text)) return text;
  const words = text.split(" ");
  if (INVARIABLE_INICIAL.has(words[0])) return text;
  // "masa refrigerada", "mezcla seca": frases que empiezan por un sustantivo no se flexionan.
  if (words.length > 1 && /a$/.test(words[0]) && !/mente$/.test(words[0])) return text;
  const target = /mente$/.test(words[0]) && words.length > 1 ? 1 : 0;
  words[target] = inflectWord(words[target], agr);
  return words.join(" ");
}

function nounUnit(key: string, text: string): Unit {
  return { kind: "noun", text, key, agr: agreementOf(text) };
}

function lookup(phrase: string, overlay?: Overlay): Unit | null {
  if (overlay?.seps && phrase in overlay.seps)
    return { kind: "sep", text: overlay.seps[phrase] };
  if (overlay?.nouns && phrase in overlay.nouns)
    return nounUnit(phrase, overlay.nouns[phrase]);
  if (overlay?.mods && phrase in overlay.mods)
    return { kind: "mod", text: overlay.mods[phrase] };
  if (phrase in MARCAS) return { kind: "sep", text: MARCAS[phrase] };
  if (phrase in SUSTANTIVOS) return nounUnit(phrase, SUSTANTIVOS[phrase]);
  if (phrase in MODIFICADORES) return { kind: "mod", text: MODIFICADORES[phrase] };
  if (phrase in NEXOS) return { kind: "sep", text: NEXOS[phrase] };
  return null;
}

/** Plural español simple para sustantivos de una palabra. */
export function pluralizeEs(word: string): string {
  if (word.includes(" ")) return word;
  if (/[aeiouáéó]$/.test(word)) return `${word}s`;
  if (/z$/.test(word)) return `${word.slice(0, -1)}ces`;
  if (/ón$/.test(word)) return `${word.slice(0, -2)}ones`;
  return `${word}es`;
}

/** Pluraliza el núcleo (primera palabra) de una frase nominal. */
function pluralizePhrase(text: string): string {
  const [head, ...rest] = text.split(" ");
  if (!/^[a-záéíóúüñ]+$/.test(head)) return text;
  return [pluralizeEs(head), ...rest].join(" ");
}

/** Intenta el singular inglés de una palabra plural del glosario. */
function lookupPlural(word: string, overlay?: Overlay): Unit | null {
  const candidates: string[] = [];
  if (word.endsWith("ies")) candidates.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ves"))
    candidates.push(`${word.slice(0, -3)}f`, `${word.slice(0, -3)}fe`);
  if (word.endsWith("es")) candidates.push(word.slice(0, -2));
  if (word.endsWith("s")) candidates.push(word.slice(0, -1));
  for (const singular of candidates) {
    const own =
      overlay?.nouns && singular in overlay.nouns ? overlay.nouns[singular] : null;
    const base = own ?? (singular in SUSTANTIVOS ? SUSTANTIVOS[singular] : null);
    if (base !== null) return nounUnit(word, pluralizePhrase(base));
  }
  return null;
}

/** Sufijos ingleses que pasan a prefijo + sustantivo ("tomato-based" → "a base de tomate"). */
const SUFIJOS: Record<string, string> = {
  based: "a base de",
  flavored: "sabor a",
  flavor: "sabor a",
  only: "solo",
  coated: "cubierto de",
  filled: "relleno de",
  stuffed: "relleno de",
  glazed: "glaseado con",
  sweetened: "endulzado con",
  seasoned: "sazonado con",
  crusted: "con costra de",
  fortified: "fortificado con",
  enriched: "enriquecido con",
  like: "tipo",
  type: "tipo",
};

function toUnits(
  tokens: string[],
  missing: string[],
  proper: ReadonlySet<string>,
  overlay?: Overlay,
): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const previous = units[units.length - 1];
    if (token in SUFIJOS && previous?.kind === "noun") {
      units[units.length - 1] = {
        kind: "mod",
        text: `${SUFIJOS[token]} ${previous.text}`,
      };
      i++;
      continue;
    }
    if (!WORD.test(token) && token !== "w/" && token !== "w/o") {
      units.push({ kind: "sep", text: token });
      i++;
      continue;
    }
    let matched = false;
    for (let len = Math.min(MAX_PHRASE_WORDS, tokens.length - i); len >= 1; len--) {
      const phrase = tokens.slice(i, i + len).join(" ");
      const unit =
        lookup(phrase, overlay) ?? (len === 1 ? lookupPlural(phrase, overlay) : null);
      if (unit) {
        units.push(unit);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched && proper.has(token)) {
      units.push({ kind: "sep", text: titleCase(token) });
      i++;
      continue;
    }
    if (!matched) {
      missing.push(token);
      units.push(nounUnit(token, `[${token}]`));
      i++;
    }
  }
  return units;
}

/** Contexto de concordancia del nombre completo (el núcleo del primer segmento). */
interface NameState {
  agr: Agreement;
  /** true cuando el núcleo ya es definitivo (no es un genérico como "snacks"). */
  locked: boolean;
  /** Fragmentos sueltos: la concordancia sigue siempre al último sustantivo núcleo. */
  follow?: boolean;
}

/**
 * Ordena un grupo de sustantivos y modificadores al orden español, con concordancia:
 * núcleo primero; los demás, de derecha a izquierda ("de X" los sustantivos); los
 * adjetivos concuerdan con el núcleo ("stuffed grape leaves" → "hojas de uva rellenas").
 */
function arrangeRun(run: Unit[], state: NameState, setContext: boolean): string {
  const nounIndexes = run.flatMap((u, i) => (u.kind === "noun" ? [i] : []));
  if (nounIndexes.length === 0) {
    return run.map((u) => inflectAdjective(u.text, state.agr)).join(" ");
  }
  const headIndex = nounIndexes[nounIndexes.length - 1];
  const head = run[headIndex] as Extract<Unit, { kind: "noun" }>;
  if (state.follow) {
    state.agr = head.agr;
  } else if (setContext && !state.locked) {
    state.agr = head.agr;
    state.locked = !GENERICOS.has(head.key);
  }
  const words = [head.text];
  for (let index = headIndex - 1; index >= 0; index--) {
    const unit = run[index];
    words.push(
      unit.kind === "noun" ? `de ${unit.text}` : inflectAdjective(unit.text, head.agr),
    );
  }
  for (const unit of run.slice(headIndex + 1)) {
    words.push(inflectAdjective(unit.text, head.agr));
  }
  return words.join(" ");
}

function arrange(units: Unit[], state: NameState): string {
  const out: string[] = [];
  let run: Unit[] = [];
  // El núcleo del nombre solo se toma de un grupo que abre el segmento.
  let opening = true;
  const flush = () => {
    if (run.length === 0) return;
    out.push(arrangeRun(run, state, opening));
    opening = false;
    run = [];
  };
  for (const unit of units) {
    if (unit.kind === "sep") {
      flush();
      opening = false;
      out.push(unit.text);
    } else {
      run.push(unit);
    }
  }
  flush();
  return out
    .join(" ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s+%/g, " %")
    .replace(/\s+,/g, ",")
    .replace(/\b(con|de|sin|y|en|para|o)\s+\1\b/g, "$1")
    .replace(/(\d)\s+"/g, '$1"')
    .replace(/(\d")(?=[A-Za-zÁ-ú(])/g, "$1 ")
    .replace(/\b([A-Z])\s\./g, "$1.")
    .replace(/\b([A-Z])\.\s(?=[A-Z]\.)/g, "$1.")
    .replace(/"\s+([^"]+?)\s+"/g, '"$1"')
    .replace(/(?:\s-){2,}/g, " –")
    .replace(/\s+/g, " ")
    .trim();
}

/** Concuerda las palabras en -o de un texto fijo marcado con "~" en SEGMENTOS. */
function agreeFixed(text: string, agr: Agreement): string {
  return text
    .split(" ")
    .map((word) =>
      /^[a-záéíóúñ]{3,}o$/.test(word) && !INVARIABLE_INICIAL.has(word)
        ? inflectWord(word, agr)
        : word,
    )
    .join(" ");
}

/** "MALT-O-MEAL" → "Malt-O-Meal"; "ARBY'S" → "Arby's". */
function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^|[\s-])([a-záéíóúñ])/g,
      (_, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

/** Palabras que USDA escribe como nombres propios: TODO EN MAYÚSCULAS o con inicial mayúscula entre paréntesis. */
function properWords(segment: string): Set<string> {
  const words = new Set<string>();
  for (const w of segment.match(/\b[A-Z][A-Z'’&-]{2,}\b/g) ?? [])
    words.add(w.toLowerCase());
  for (const group of segment.match(/\([^)]*\)/g) ?? []) {
    for (const w of group.match(/\b[A-Z][a-z'’]+\b/g) ?? []) words.add(w.toLowerCase());
  }
  return words;
}

const PARTICIPIO = /(ado|ido|ito|isto|esto|erto|ecto|cho|uso|eso)$/;

/** Los textos fijos que empiezan con un participio concuerdan con el núcleo del nombre. */
function agreeParticiples(text: string, agr: Agreement): string {
  const first = text.split(" ")[0];
  if (!PARTICIPIO.test(first) && !["o", "y", "u", "e"].includes(first)) return text;
  return text
    .split(" ")
    .map((word) => (PARTICIPIO.test(word) ? inflectWord(word, agr) : word))
    .join(" ");
}

function translateSegment(segment: string, missing: string[], state: NameState): string {
  const key = segment.toLowerCase();
  if (key in SEGMENTOS) {
    const value = SEGMENTOS[key];
    return value.startsWith("~")
      ? agreeFixed(value.slice(1), state.agr)
      : agreeParticiples(value, state.agr);
  }
  // Aclaración fija entre paréntesis al final del segmento: "calor seco (may contain …)".
  for (const [paren, text] of Object.entries(SEGMENTOS)) {
    if (paren.startsWith("(") && key.length > paren.length && key.endsWith(` ${paren}`)) {
      const head = translateSegment(
        segment.slice(0, segment.length - paren.length - 1),
        missing,
        state,
      );
      return `${head} ${text}`;
    }
  }
  for (const [pattern, replacement] of PATRONES_SEGMENTO) {
    if (pattern.test(key)) return key.replace(pattern, replacement);
  }
  // Graduación alcohólica: "80 proof" = 40 % de alcohol.
  const proof = key.match(/^(.*?)\(?(\d+)\)? proof$/);
  if (proof) {
    const prefix = proof[1].trim()
      ? `${translateSegment(proof[1].trim(), missing, state)} `
      : "";
    return `${prefix}${Number(proof[2]) / 2} % de alcohol`;
  }
  // "contains caffeine" → "contiene cafeína".
  const contains = key.match(/^(?:contains|containing) (.+)$/);
  if (contains) return `contiene ${translateSegment(contains[1], missing, state)}`;
  // FNDDS: "Baby Toddler pears" = "peras para niños pequeños".
  const toddler = key.match(/^baby toddler (.+)$/);
  if (toddler) {
    return `${translateSegment(toddler[1], missing, state)} para niños pequeños`;
  }
  // FNDDS: "NS as to <algo>" = "<algo> sin especificar".
  const ns = key.match(/^ns as to (.+)$/);
  if (ns) return `${translateSegment(ns[1], missing, state)} sin especificar`;
  const letters = segment.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length >= 3 && letters === letters.toUpperCase();
  const local: string[] = [];
  const saved = { ...state };
  const proper = properWords(segment);
  const text = arrange(toUnits(tokenize(key, undefined, proper), local, proper), state);
  if (allCaps) {
    // Segmento en mayúsculas con palabras desconocidas: es una marca; se conserva.
    const unknown: string[] = [];
    toUnits(tokenize(key), unknown, new Set());
    if (unknown.length > 0) {
      state.agr = saved.agr;
      state.locked = saved.locked;
      return titleCase(segment);
    }
  }
  missing.push(...local);
  return text;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Traduce un nombre de USDA con el glosario. */
export function translateName(nameEn: string): NameTranslation {
  const full = NOMBRES[nameEn.trim().toLowerCase()];
  if (full !== undefined) return { text: full, complete: true, missing: [] };
  const missing: string[] = [];
  const state: NameState = { agr: { gender: "m", plural: false }, locked: false };
  const parts = splitSegments(nameEn)
    .map((segment) => translateSegment(segment, missing, state))
    .filter((part) => part !== "");
  // Segmentos repetidos tras traducir (p. ej. "magro" dos veces) se dejan una vez.
  const distinct = parts.filter((part, i) => parts.indexOf(part) === i);
  // "Salsa, salsa mexicana" → "Salsa mexicana": un segmento que repite al anterior como
  // inicio de su propio texto lo reemplaza.
  const unique = distinct.filter((part, i) => {
    const next = distinct[i + 1];
    if (next === undefined) return true;
    const a = part.toLowerCase();
    const b = next.toLowerCase();
    return !(
      b.startsWith(a) &&
      (b.length === a.length || /^[\s(]/.test(b.slice(a.length)))
    );
  });
  const text = capitalize(unique.join(", "));
  return { text, complete: missing.length === 0 && text !== "", missing };
}

/**
 * Traduce un fragmento suelto (p. ej. parte de una etiqueta de porción) con el mismo
 * glosario, más un overlay opcional. `proper` son las palabras que se conservan como
 * nombres propios si no están en el glosario; `agr` es la concordancia de los
 * adjetivos sin sustantivo propio.
 */
export function translateFragment(
  text: string,
  options: { overlay?: Overlay; proper?: ReadonlySet<string>; agr?: Agreement } = {},
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const state: NameState = {
    agr: options.agr ?? { gender: "m", plural: false },
    locked: false,
    follow: true,
  };
  const units = toUnits(
    tokenize(text.toLowerCase(), options.overlay, options.proper),
    missing,
    options.proper ?? new Set(),
    options.overlay,
  );
  return { text: arrange(units, state), missing };
}
