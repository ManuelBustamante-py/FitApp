/**
 * Diccionario de traducciones supervisado (CSV versionado en el repositorio).
 *
 * Columnas:
 * - source, source_id: identifican el alimento (usda_fdc / usda_fndds + fdc_id).
 * - name_en: nombre original de USDA.
 * - name_es: nombre en español que se carga. Vacío = sin traducción (no se carga).
 * - status: `borrador` (propuesto o editado, sin revisar) o `revisado`.
 * - auto_es: última propuesta del glosario. Las palabras sin traducir van entre
 *   corchetes. Sirve para saber si name_es fue editado a mano: si name_es es
 *   distinto de auto_es, es una edición manual y el generador no lo toca.
 */

import { formatCsv, parseCsv } from "../lib/csv.ts";

import type { NameTranslation } from "./translate.ts";

export const TRANSLATION_COLUMNS = [
  "source",
  "source_id",
  "name_en",
  "name_es",
  "status",
  "auto_es",
] as const;

export type TranslationStatus = "borrador" | "revisado";

export interface TranslationRow {
  source: string;
  sourceId: string;
  nameEn: string;
  nameEs: string;
  status: TranslationStatus;
  autoEs: string;
}

export function translationKey(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

/** Lee el CSV de traducciones; lanza un error con el número de línea si es inválido. */
export function parseTranslations(text: string): TranslationRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const missingColumns = TRANSLATION_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length > 0) {
    throw new Error(`CSV de traducciones sin columnas: ${missingColumns.join(", ")}`);
  }
  const col = (name: (typeof TRANSLATION_COLUMNS)[number]) => header.indexOf(name);
  const seen = new Set<string>();
  return body.map((row, i) => {
    const line = i + 2;
    const get = (name: (typeof TRANSLATION_COLUMNS)[number]) =>
      (row[col(name)] ?? "").trim();
    const status = get("status") || "borrador";
    if (status !== "borrador" && status !== "revisado") {
      throw new Error(
        `Línea ${line}: status "${status}" inválido (usa "borrador" o "revisado")`,
      );
    }
    const source = get("source");
    const sourceId = get("source_id");
    if (!source || !sourceId) throw new Error(`Línea ${line}: falta source o source_id`);
    const key = translationKey(source, sourceId);
    if (seen.has(key)) throw new Error(`Línea ${line}: fila repetida ${key}`);
    seen.add(key);
    const nameEs = get("name_es");
    if (status === "revisado" && !nameEs) {
      throw new Error(`Línea ${line}: una fila "revisado" debe tener name_es`);
    }
    return {
      source,
      sourceId,
      nameEn: get("name_en"),
      nameEs,
      status,
      autoEs: get("auto_es"),
    };
  });
}

function compareRows(a: TranslationRow, b: TranslationRow): number {
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  const na = Number(a.sourceId);
  const nb = Number(b.sourceId);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
}

/** Serializa ordenado por fuente e id (diffs estables entre ejecuciones). */
export function formatTranslations(rows: readonly TranslationRow[]): string {
  const sorted = [...rows].sort(compareRows);
  return formatCsv([
    [...TRANSLATION_COLUMNS],
    ...sorted.map((r) => [r.source, r.sourceId, r.nameEn, r.nameEs, r.status, r.autoEs]),
  ]);
}

export interface TranslationCandidate {
  source: string;
  sourceId: string;
  nameEn: string;
  auto: NameTranslation;
}

export interface MergeStats {
  /** Filas nuevas agregadas. */
  added: number;
  /** Borradores automáticos actualizados con la nueva propuesta. */
  updated: number;
  /** Filas revisadas o editadas a mano que se conservaron. */
  preserved: number;
  /** Filas revisadas cuyo name_en cambió en USDA (conviene revisarlas de nuevo). */
  reviewedNameChanged: number;
  /** Filas sin cambios. */
  unchanged: number;
  /** Filas del CSV que no aparecieron en los datos leídos (se conservan). */
  notInInput: number;
}

/**
 * Fusiona las propuestas del glosario con el CSV existente sin pisar el trabajo
 * manual:
 * - fila nueva → borrador; name_es solo si la traducción automática es completa.
 * - `revisado` → no se modifica.
 * - `borrador` con name_es editado a mano (≠ auto_es) → se conserva name_es y
 *   solo se actualizan name_en y auto_es.
 * - `borrador` automático o vacío → se reemplaza por la nueva propuesta.
 * - filas que ya no vienen en los datos → se conservan tal cual.
 */
export function mergeTranslations(
  existing: readonly TranslationRow[],
  candidates: Iterable<TranslationCandidate>,
): { rows: TranslationRow[]; stats: MergeStats } {
  const byKey = new Map(existing.map((r) => [translationKey(r.source, r.sourceId), r]));
  const touched = new Set<string>();
  const stats: MergeStats = {
    added: 0,
    updated: 0,
    preserved: 0,
    reviewedNameChanged: 0,
    unchanged: 0,
    notInInput: 0,
  };

  for (const candidate of candidates) {
    const key = translationKey(candidate.source, candidate.sourceId);
    if (touched.has(key)) continue;
    touched.add(key);
    const autoEs = candidate.auto.text;
    const proposed = candidate.auto.complete ? autoEs : "";
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, {
        source: candidate.source,
        sourceId: candidate.sourceId,
        nameEn: candidate.nameEn,
        nameEs: proposed,
        status: "borrador",
        autoEs,
      });
      stats.added++;
      continue;
    }

    if (current.status === "revisado") {
      stats.preserved++;
      if (current.nameEn !== candidate.nameEn) stats.reviewedNameChanged++;
      continue;
    }

    const manual = current.nameEs !== "" && current.nameEs !== current.autoEs;
    const next: TranslationRow = manual
      ? { ...current, nameEn: candidate.nameEn, autoEs }
      : { ...current, nameEn: candidate.nameEn, nameEs: proposed, autoEs };
    if (manual) stats.preserved++;
    const changed =
      next.nameEn !== current.nameEn ||
      next.nameEs !== current.nameEs ||
      next.autoEs !== current.autoEs;
    if (!manual) {
      if (changed) stats.updated++;
      else stats.unchanged++;
    }
    byKey.set(key, next);
  }

  for (const key of byKey.keys()) {
    if (!touched.has(key)) stats.notInInput++;
  }
  return { rows: [...byKey.values()].sort(compareRows), stats };
}

export type TranslationDecision =
  | { ok: true; nameEs: string; status: TranslationStatus }
  | { ok: false; reason: "sin_traduccion" | "no_revisado" };

/** Decide qué nombre en español usa el ETL para un alimento. */
export function resolveTranslation(
  row: TranslationRow | undefined,
  onlyReviewed: boolean,
): TranslationDecision {
  if (!row || !row.nameEs) return { ok: false, reason: "sin_traduccion" };
  if (onlyReviewed && row.status !== "revisado")
    return { ok: false, reason: "no_revisado" };
  return { ok: true, nameEs: row.nameEs, status: row.status };
}
