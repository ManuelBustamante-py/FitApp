/**
 * ETL de USDA FoodData Central (Foundation, SR Legacy, FNDDS) → Supabase.
 *
 *   npm run ingest:usda -- <carpeta> [<carpeta>…] [opciones]
 *
 * Opciones:
 *   --translations <csv>  diccionario de nombres (por defecto scripts/ingest/usda/translations.csv)
 *   --only-reviewed       carga solo las traducciones con status "revisado" (confirmadas por una persona)
 *   --dry-run             lee, traduce y valida sin escribir en la base
 *   --report <json>       guarda el informe completo (omitidos y errores) en un JSON
 *   --batch-size <n>      alimentos por lote de escritura (por defecto 500)
 *
 * Ver scripts/ingest/README.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { findDatasetDirs, readDataset } from "./dataset.ts";
import { createServiceClient, loadFoods, loadNutrientIds } from "./load.ts";
import { normalizeFood, sourceForDataType, type NormalizedFood } from "./normalize.ts";
import { NUTRIENT_MAPPINGS } from "./nutrients.ts";
import { formatReport, ReportBuilder } from "./report.ts";
import {
  parseTranslations,
  resolveTranslation,
  translationKey,
  type TranslationStatus,
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
      "only-reviewed": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      report: { type: "string" },
      "batch-size": { type: "string", default: "500" },
    },
  });
  if (positionals.length === 0) {
    throw new Error(
      "Indica la carpeta con las descargas CSV de USDA. Ej.: npm run ingest:usda -- scripts/ingest/data/usda",
    );
  }
  const batchSize = Number(values["batch-size"]);
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("--batch-size debe ser un entero positivo");
  }
  const onlyReviewed = values["only-reviewed"];
  const dryRun = values["dry-run"];

  const dirs = positionals.flatMap(findDatasetDirs);
  if (dirs.length === 0)
    throw new Error("No se encontró ningún food.csv en las carpetas dadas");

  const translations = new Map(
    parseTranslations(readFileSync(values.translations, "utf8")).map((row) => [
      translationKey(row.source, row.sourceId),
      row,
    ]),
  );

  const report = new ReportBuilder({ dryRun, onlyReviewed, dirs });
  const toLoad: { food: NormalizedFood; status: TranslationStatus }[] = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    console.log(`Leyendo ${dir}…`);
    const foods = await readDataset(dir);
    for (const food of foods) {
      const source = sourceForDataType(food.dataType)!;
      const key = translationKey(source, food.fdcId);
      const item = { source, sourceId: food.fdcId, nameEn: food.description };
      if (seen.has(key)) {
        report.omitted({ ...item, reason: "duplicado" });
        continue;
      }
      seen.add(key);
      const decision = resolveTranslation(translations.get(key), onlyReviewed);
      if (!decision.ok) {
        report.omitted({ ...item, reason: decision.reason });
        continue;
      }
      const result = normalizeFood(food, decision.nameEs);
      if (!result.ok) {
        if (result.kind === "omitido") report.omitted({ ...item, reason: result.reason });
        else report.error({ ...item, reason: result.reason });
        continue;
      }
      toLoad.push({ food: result.food, status: decision.status });
      report.imported(source, decision.status, {
        kcalCalculada: result.food.kcalCalculada,
        portions: result.food.portions.length,
        untranslated: result.food.portionsSinTraducir,
      });
    }
  }

  if (!dryRun && toLoad.length > 0) {
    const db = createServiceClient();
    const nutrientIds = await loadNutrientIds(db);
    const missing = NUTRIENT_MAPPINGS.filter((m) => !nutrientIds.has(m.code));
    if (missing.length > 0) {
      console.warn(
        `Aviso: public.nutrient no tiene ${missing.map((m) => m.code).join(", ")}; esos valores no se cargan.`,
      );
    }
    const statusByKey = new Map(
      toLoad.map((t) => [translationKey(t.food.source, t.food.sourceId), t.status]),
    );
    const { errors } = await loadFoods(
      db,
      toLoad.map((t) => t.food),
      {
        nutrientIds,
        batchSize,
        onProgress: (done, total) => console.log(`  ${done}/${total} alimentos escritos`),
      },
    );
    for (const e of errors) {
      report.failedAfterImport(
        { source: e.source, sourceId: e.sourceId, nameEn: e.nameEn, reason: e.error },
        statusByKey.get(translationKey(e.source, e.sourceId)) ?? "borrador",
      );
    }
  }

  const built = report.build();
  console.log(formatReport(built));
  if (values.report) {
    writeFileSync(values.report, JSON.stringify(built, null, 2) + "\n", "utf8");
    console.log(`Informe completo en ${values.report}`);
  }
  if (built.totales.errores > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
