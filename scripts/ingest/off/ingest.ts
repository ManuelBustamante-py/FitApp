/**
 * ETL de Open Food Facts (Chile / LatAm) → Supabase.
 *
 *   npm run ingest:off -- <archivo.csv|.tsv|.jsonl[.gz]> [opciones]
 *
 * Opciones:
 *   --countries <tags>  etiquetas countries_tags separadas por coma (por defecto en:chile)
 *   --latam             acepta los países de LatAm (lista en normalize.ts); se suma a --countries
 *   --dry-run           lee y valida sin escribir en la base
 *   --report <json>     guarda el informe completo (motivo por registro descartado) en un JSON
 *   --batch-size <n>    productos por lote de escritura (por defecto 500)
 *
 * El archivo se descarga a mano (ver scripts/ingest/README.md) y se procesa en streaming.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { createServiceClient, loadNutrientIds } from "../usda/load.ts";

import { loadOffFoods } from "./load.ts";
import {
  CHILE_TAG,
  LATAM_COUNTRY_TAGS,
  processProduct,
  type OffFood,
} from "./normalize.ts";
import { readOffFile } from "./read.ts";
import { formatReport, OffReportBuilder } from "./report.ts";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      countries: { type: "string" },
      latam: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      report: { type: "string" },
      "batch-size": { type: "string", default: "500" },
    },
  });
  if (positionals.length !== 1) {
    throw new Error(
      "Indica el archivo de Open Food Facts. Ej.: npm run ingest:off -- scripts/ingest/data/off/en.openfoodfacts.org.products.csv.gz --dry-run",
    );
  }
  const batchSize = Number(values["batch-size"]);
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("--batch-size debe ser un entero positivo");
  }
  const dryRun = values["dry-run"];

  const countries = new Set<string>(
    values.countries
      ? values.countries
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
      : [CHILE_TAG],
  );
  if (values.latam) for (const tag of LATAM_COUNTRY_TAGS) countries.add(tag);

  const report = new OffReportBuilder({ dryRun, countries: [...countries] });
  const toLoad: OffFood[] = [];
  const seen = new Set<string>();

  console.log(`Leyendo ${positionals[0]}…`);
  for await (const item of readOffFile(positionals[0])) {
    report.read();
    if (!item.ok) {
      report.invalid({
        code: "",
        name: `línea ${item.line}`,
        reason: "linea_ilegible",
        detail: item.error,
      });
      continue;
    }
    const raw = item.product;
    const result = processProduct(raw, { countries });
    if (result.kind === "fuera_de_pais") {
      report.outOfCountry();
      continue;
    }
    const label = {
      code: raw.code,
      name: raw.productNameEs || raw.productName,
    };
    if (result.kind === "invalido") {
      report.invalid({ ...label, reason: result.reason, detail: result.detail });
      continue;
    }
    if (seen.has(result.food.barcode)) {
      report.duplicate({
        ...label,
        reason: "duplicado",
        detail: "código de barras repetido; se conserva la primera aparición",
      });
      continue;
    }
    seen.add(result.food.barcode);
    toLoad.push(result.food);
    report.imported(result.food.kcalDesdeKj);
  }

  if (!dryRun && toLoad.length > 0) {
    const db = createServiceClient();
    const nutrientIds = await loadNutrientIds(db);
    const { errors } = await loadOffFoods(db, toLoad, {
      nutrientIds,
      batchSize,
      onProgress: (done, total) => console.log(`  ${done}/${total} productos escritos`),
    });
    const byCode = new Map(toLoad.map((f) => [f.barcode, f]));
    for (const e of errors) {
      report.failedAfterImport(
        { code: e.barcode, name: e.name, reason: "error_de_carga", detail: e.error },
        byCode.get(e.barcode)?.kcalDesdeKj ?? false,
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
