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
  MODIFICADORES,
  NEXOS,
  PATRONES_SEGMENTO,
  SEGMENTOS,
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

type Unit = { kind: "noun" | "mod"; text: string } | { kind: "sep"; text: string };

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

function tokenize(segment: string): string[] {
  const raw =
    segment.match(
      /w\/o|w\/|[a-z][a-z'’]*(?:-[a-z][a-z'’]*)*|\d+(?:[.,/-]\d+)*%?|[^\sa-z\d]/g,
    ) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    // Palabras con guion que no están en el glosario se separan en sus partes.
    if (token.includes("-") && WORD.test(token) && !lookup(token)) {
      tokens.push(...token.split("-"));
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

function lookup(phrase: string): Unit | null {
  if (phrase in SUSTANTIVOS) return { kind: "noun", text: SUSTANTIVOS[phrase] };
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

/** Intenta el singular inglés de una palabra plural del glosario. */
function lookupPlural(word: string): Unit | null {
  const candidates: string[] = [];
  if (word.endsWith("ies")) candidates.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es")) candidates.push(word.slice(0, -2));
  if (word.endsWith("s")) candidates.push(word.slice(0, -1));
  for (const singular of candidates) {
    if (singular in SUSTANTIVOS) {
      return { kind: "noun", text: pluralizeEs(SUSTANTIVOS[singular]) };
    }
  }
  return null;
}

function toUnits(tokens: string[], missing: string[]): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!WORD.test(token) && token !== "w/" && token !== "w/o") {
      units.push({ kind: "sep", text: token });
      i++;
      continue;
    }
    let matched = false;
    for (let len = Math.min(MAX_PHRASE_WORDS, tokens.length - i); len >= 1; len--) {
      const phrase = tokens.slice(i, i + len).join(" ");
      const unit = lookup(phrase) ?? (len === 1 ? lookupPlural(phrase) : null);
      if (unit) {
        units.push(unit);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      missing.push(token);
      units.push({ kind: "noun", text: `[${token}]` });
      i++;
    }
  }
  return units;
}

/** Invierte cada grupo de sustantivos/modificadores al orden español. */
function arrange(units: Unit[]): string {
  const out: string[] = [];
  let run: Unit[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const reversed = [...run].reverse();
    const [head, ...rest] = reversed;
    const words = [head.text];
    for (const unit of rest) {
      words.push(unit.kind === "noun" ? `de ${unit.text}` : unit.text);
    }
    out.push(words.join(" "));
    run = [];
  };
  for (const unit of units) {
    if (unit.kind === "sep") {
      flush();
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
    .replace(/\s+/g, " ")
    .trim();
}

function translateSegment(segment: string, missing: string[]): string {
  const key = segment.toLowerCase();
  if (key in SEGMENTOS) return SEGMENTOS[key];
  for (const [pattern, replacement] of PATRONES_SEGMENTO) {
    if (pattern.test(key)) return key.replace(pattern, replacement);
  }
  // FNDDS: "NS as to <algo>" = "<algo> sin especificar".
  const ns = key.match(/^ns as to (.+)$/);
  if (ns) return `${translateSegment(ns[1], missing)} sin especificar`;
  return arrange(toUnits(tokenize(key), missing));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Traduce un nombre de USDA con el glosario. */
export function translateName(nameEn: string): NameTranslation {
  const missing: string[] = [];
  const parts = splitSegments(nameEn)
    .map((segment) => translateSegment(segment, missing))
    .filter((part) => part !== "");
  // Segmentos repetidos tras traducir (p. ej. "magro" dos veces) se dejan una vez.
  const unique = parts.filter((part, i) => parts.indexOf(part) === i);
  const text = capitalize(unique.join(", "));
  return { text, complete: missing.length === 0 && text !== "", missing };
}
