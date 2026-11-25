/** Utilidades puras de la búsqueda de alimentos (sin acceso a datos). */

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
export const DEFAULT_RESULTS = 30;

/** Misma normalización que la función SQL: sin tildes, minúsculas, espacios colapsados. */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Consulta lista para enviar: recortada, con espacios colapsados y largo acotado. */
export function cleanQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

export function isSearchable(raw: string): boolean {
  return normalizeQuery(raw).length >= MIN_QUERY_LENGTH;
}

/** Código de barras: 6 a 14 dígitos (igual que food.barcode). */
export function isBarcode(raw: string): boolean {
  return /^[0-9]{6,14}$/.test(raw.trim());
}

/** Prioridad de fuente (menor = primero), igual que docs/04-fuentes-de-datos.md. */
export function sourceRank(source: string, isOwn: boolean): number {
  if (isOwn) return 0;
  switch (source) {
    case "cl_inta":
      return 1;
    case "usda_fdc":
      return 2;
    case "usda_fndds":
      return 3;
    case "off":
      return 4;
    case "usda_branded":
      return 5;
    default:
      return 6;
  }
}

/**
 * Prioridad por país (menor = primero), igual que la función SQL: 0 si el alimento es
 * del país del usuario o no tiene país (USDA, propios, recetas); 1 si es de otro país.
 */
export function countryRank(
  countries: readonly string[] | null | undefined,
  userCountry: string,
): 0 | 1 {
  return !countries || countries.length === 0 || countries.includes(userCountry) ? 0 : 1;
}

/** Texto de la base nutricional del alimento. */
export function basisLabel(basis: string): string {
  return basis === "per_100ml" ? "100 ml" : "100 g";
}
