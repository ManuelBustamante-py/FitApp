/**
 * Genera o actualiza el borrador del diccionario de traducciones (CSV) a partir
 * de las descargas de USDA, sin pisar filas revisadas ni ediciones manuales.
 *
 *   npm run ingest:usda:translations -- <carpeta> [<carpeta>…] [--translations <csv>]
 *
 * Ver scripts/ingest/README.md (flujo de revisión).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { findDatasetDirs, readFoodNames } from "./dataset.ts";
import { sourceForDataType } from "./normalize.ts";
import { translateName } from "./translate.ts";
import {
  formatTranslations,
  mergeTranslations,
  parseTranslations,
  type TranslationCandidate,
} from "./translations.ts";

const DEFAULT_TRANSLATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "translations.csv",
);

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      translations: { type: "string", default: DEFAULT_TRANSLATIONS },
      "top-missing": { type: "string", default: "30" },
    },
  });
  if (positionals.length === 0) {
    throw new Error(
      "Indica la carpeta con las descargas CSV de USDA. Ej.: npm run ingest:usda:translations -- scripts/ingest/data/usda",
    );
  }
  const dirs = positionals.flatMap(findDatasetDirs);
  if (dirs.length === 0)
    throw new Error("No se encontró ningún food.csv en las carpetas dadas");

  const candidates: TranslationCandidate[] = [];
  const missingWords = new Map<string, number>();
  for (const dir of dirs) {
    console.log(`Leyendo ${dir}…`);
    for (const food of await readFoodNames(dir)) {
      const auto = translateName(food.description);
      for (const word of auto.missing) {
        missingWords.set(word, (missingWords.get(word) ?? 0) + 1);
      }
      candidates.push({
        source: sourceForDataType(food.dataType)!,
        sourceId: food.fdcId,
        nameEn: food.description,
        auto,
      });
    }
  }

  const path = values.translations;
  const existing = existsSync(path) ? parseTranslations(readFileSync(path, "utf8")) : [];
  const { rows, stats } = mergeTranslations(existing, candidates);
  writeFileSync(path, formatTranslations(rows), "utf8");

  const withName = rows.filter((r) => r.nameEs !== "").length;
  const reviewed = rows.filter((r) => r.status === "revisado").length;
  const reviewedAi = rows.filter((r) => r.status === "revisado_ia").length;
  console.log(`Diccionario actualizado: ${path}`);
  console.log(
    `  ${rows.length} filas · ${withName} con name_es · ${reviewed} revisadas · ${reviewedAi} revisadas por IA · ${rows.length - withName} sin traducción`,
  );
  console.log(
    `  nuevas ${stats.added} · borradores actualizados ${stats.updated} · conservadas (revisadas, revisadas por IA o editadas) ${stats.preserved} · sin cambios ${stats.unchanged} · no presentes en los datos ${stats.notInInput}`,
  );
  if (stats.reviewedNameChanged > 0) {
    console.log(
      `  Atención: ${stats.reviewedNameChanged} filas revisadas cambiaron su name_en en USDA; conviene revisarlas.`,
    );
  }
  const top = [...missingWords.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Number(values["top-missing"]) || 0);
  if (top.length > 0) {
    console.log(
      "Palabras sin glosario más frecuentes (agregarlas a glossary.ts mejora el borrador):",
    );
    console.log(`  ${top.map(([w, n]) => `${w} (${n})`).join(", ")}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
