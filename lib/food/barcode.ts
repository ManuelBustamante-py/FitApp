/** Validación de códigos de barras GS1 (EAN-13, EAN-8, UPC-A y GTIN-14). Sin acceso a datos. */

import { countryRank, sourceRank } from "./search";

/** Largos con dígito verificador GS1 que admite el escaneo. */
export const BARCODE_LENGTHS = [8, 12, 13, 14] as const;

/** Deja solo los dígitos (el lector manual puede traer espacios o guiones). */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/[\s-]+/g, "");
}

/** Dígito verificador GS1 esperado para el cuerpo (el código sin su último dígito). */
export function checkDigit(body: string): number {
  let sum = 0;
  // Desde la derecha del cuerpo los pesos alternan 3, 1, 3, 1…
  for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** true si es numérico, de largo 8/12/13/14 y su dígito verificador coincide. */
export function isValidBarcode(raw: string): boolean {
  const code = normalizeBarcode(raw);
  if (!/^[0-9]+$/.test(code)) return false;
  if (!(BARCODE_LENGTHS as readonly number[]).includes(code.length)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Variantes con las que puede estar guardado el mismo producto: un UPC-A de 12 dígitos
 * equivale a un EAN-13 con un 0 delante (y viceversa), y Open Food Facts mezcla ambos.
 */
export function barcodeCandidates(raw: string): string[] {
  const code = normalizeBarcode(raw);
  const out = new Set([code]);
  if (code.length === 12) out.add(`0${code}`);
  if (code.length === 13 && code.startsWith("0")) out.add(code.slice(1));
  return [...out];
}

export interface BarcodeMatch {
  id: string;
  source: string;
  owner_user_id: string | null;
  countries: string[] | null;
}

/**
 * Elige entre varios alimentos con el mismo código: primero el propio, luego el del
 * país del usuario (o sin país), luego la prioridad de fuente. null si no hay ninguno.
 */
export function pickBarcodeMatch(
  matches: readonly BarcodeMatch[],
  userId: string,
  userCountry: string,
): BarcodeMatch | null {
  const key = (m: BarcodeMatch) => {
    const own = m.owner_user_id === userId;
    return [
      own ? 0 : 1,
      countryRank(m.countries, userCountry),
      sourceRank(m.source, own),
    ];
  };
  let best: { match: BarcodeMatch; key: number[] } | null = null;
  for (const match of matches) {
    const k = key(match);
    if (!best || isBefore(k, best.key)) best = { match, key: k };
  }
  return best?.match ?? null;
}

/** Orden lexicográfico estricto: true si a va antes que b (los empates conservan el orden). */
function isBefore(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
