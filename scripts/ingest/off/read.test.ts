import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  processProduct,
  CHILE_TAG,
  LATAM_COUNTRY_TAGS,
  type OffFood,
} from "./normalize.ts";
import { avisoEncabezadoCsv, detectFormat, readOffFile, type ReadItem } from "./read.ts";
import { OffReportBuilder, formatReport, infoCategoria } from "./report.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

async function collect(path: string): Promise<ReadItem[]> {
  const items: ReadItem[] = [];
  for await (const item of readOffFile(path)) items.push(item);
  return items;
}

/** Misma lógica que ingest.ts (filtro, validación, deduplicación e informe). */
async function run(path: string, countries: string[]) {
  const set = new Set(countries);
  const report = new OffReportBuilder({ dryRun: true, countries });
  const seen = new Set<string>();
  const loaded: string[] = [];
  const foods: OffFood[] = [];
  for (const item of await collect(path)) {
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
    const result = processProduct(item.product, { countries: set });
    const label = { code: item.product.code, name: item.product.productName };
    if (result.kind === "fuera_de_pais") report.outOfCountry();
    else if (result.kind === "invalido") {
      report.invalid({ ...label, reason: result.reason, detail: result.detail });
    } else if (seen.has(result.food.barcode)) {
      report.duplicate({ ...label, reason: "duplicado", detail: "repetido" });
    } else {
      seen.add(result.food.barcode);
      loaded.push(result.food.barcode);
      report.imported(result.food.kcalDesdeKj, infoCategoria(result.food));
      foods.push(result.food);
    }
  }
  return { report: report.build(), loaded, foods };
}

describe("detectFormat", () => {
  it("reconoce CSV/TSV y JSONL, con o sin .gz", () => {
    expect(detectFormat("a.csv")).toBe("tsv");
    expect(detectFormat("a.csv.gz")).toBe("tsv");
    expect(detectFormat("a.JSONL.GZ")).toBe("jsonl");
    expect(() => detectFormat("a.parquet")).toThrow(/Formato no reconocido/);
  });
});

describe("aviso de nombres en inglés en el CSV", () => {
  it("avisa si el encabezado no trae product_name_en ni product_name_es", () => {
    const aviso = avisoEncabezadoCsv(["code", "product_name", "generic_name"]);
    expect(aviso).toMatch(/name_en quedará vacío/);
    expect(aviso).toMatch(/jsonl/i);
  });

  it("no avisa si trae product_name_es o product_name_en", () => {
    expect(avisoEncabezadoCsv(["code", "product_name", "product_name_es"])).toBeNull();
    expect(avisoEncabezadoCsv(["code", "product_name_en"])).toBeNull();
  });
});

describe("export TSV de Open Food Facts", () => {
  const path = join(FIXTURES, "sample.tsv");

  it("lee las filas por nombre de columna", async () => {
    const items = await collect(path);
    expect(items).toHaveLength(10);
    const first = items[0];
    expect(first.ok && first.product).toMatchObject({
      code: "7801234567890",
      productNameEs: "Galletas de vainilla",
      countriesTags: ["en:chile", "en:argentina"],
    });
    expect(first.ok && first.product.nutriments["energy-kcal_100g"]).toBe(480);
  });

  it("filtra Chile, valida, deduplica y cuenta", async () => {
    const { report, loaded } = await run(path, [CHILE_TAG]);
    expect(loaded).toEqual(["7801234567890", "7809999999991", "7801111111111"]);
    expect(report.totales).toMatchObject({
      leidos: 10,
      fueraDePais: 1,
      importados: 3,
      invalidos: 5,
      duplicados: 1,
    });
    expect(report.kcalDesdeKj).toBe(1);
    expect(report.invalidosPorMotivo).toEqual({
      sin_codigo_barras: 1,
      sin_nombre: 1,
      kcal_fuera_de_rango: 1,
      nutriente_fuera_de_rango: 1,
      sin_energia: 1,
    });
    // Un registro con motivo por cada descartado.
    expect(report.invalidos.map((i) => [i.code, i.reason])).toEqual([
      ["abc", "sin_codigo_barras"],
      ["7802222222222", "sin_nombre"],
      ["7803333333333", "kcal_fuera_de_rango"],
      ["7804444444444", "nutriente_fuera_de_rango"],
      ["7805555555555", "sin_energia"],
    ]);
    expect(report.duplicados[0].code).toBe("7801234567890");
  });

  it("asigna categoría en español y name_en, y mide la cobertura", async () => {
    const { report, foods } = await run(path, [CHILE_TAG]);
    expect(foods.map((f) => [f.barcode, f.category, f.nameEn])).toEqual([
      ["7801234567890", "Galletas y brownies", "Vanilla cookies"],
      ["7809999999991", "Barras de cereal", "Cereal bar"],
      ["7801111111111", "Sin categoría", null],
    ]);
    expect(report.categorias).toEqual({
      conCategoria: 2,
      sinCategoria: 1,
      conNombreEn: 2,
      etiquetasSinMapear: [
        { etiqueta: "bebida-misteriosa", productos: 1 },
        { etiqueta: "beverages", productos: 1 },
        { etiqueta: "non-alcoholic-beverages", productos: 1 },
      ],
    });
    const text = formatReport(report);
    expect(text).toContain('"Sin categoría" 1');
    expect(text).toContain("beverages 1");
  });

  it("formatReport resume conteos y motivos", async () => {
    const { report } = await run(path, [CHILE_TAG]);
    const text = formatReport(report);
    expect(text).toContain("Importados: 3");
    expect(text).toContain("Descartados: 5");
    expect(text).toContain("sin_codigo_barras 1");
    expect(text).toContain("7803333333333 Aceite imposible → kcal_fuera_de_rango");
  });
});

describe("export JSONL de Open Food Facts", () => {
  const path = join(FIXTURES, "sample.jsonl");

  it("lee nutriments anidados, números como texto y líneas ilegibles", async () => {
    const items = await collect(path);
    expect(items).toHaveLength(5);
    const mexican = items[1];
    expect(mexican.ok && mexican.product.nutriments["proteins_100g"]).toBe(7.5);
    expect(mexican.ok && mexican.product.nutriments["energy-kj_100g"]).toBe(1500);
    expect(
      items[2].ok && Number.isNaN(items[2].product.nutriments["energy-kcal_100g"]),
    ).toBe(true);
    expect(items[4]).toMatchObject({ ok: false, line: 5 });
  });

  it("solo Chile: importa el yogur, descarta lo ilegible y no numérico", async () => {
    const { report, loaded } = await run(path, [CHILE_TAG]);
    expect(loaded).toEqual(["7806666666666"]);
    expect(report.totales).toMatchObject({ fueraDePais: 2, importados: 1, invalidos: 2 });
    expect(report.invalidosPorMotivo).toEqual({
      valor_no_numerico: 1,
      linea_ilegible: 1,
    });
  });

  it("con LatAm también entra México (kcal desde kJ)", async () => {
    const { report, loaded } = await run(path, [...LATAM_COUNTRY_TAGS]);
    expect(loaded).toEqual(["7806666666666", "7807777777777"]);
    expect(report.kcalDesdeKj).toBe(1);
  });

  it("usa main_category, categories_tags y name_en / generic_name_en", async () => {
    const { foods } = await run(path, [...LATAM_COUNTRY_TAGS]);
    expect(foods.map((f) => [f.category, f.nameEn])).toEqual([
      ["Yogur regular", "Natural yogurt"],
      ["Pretzels y mezclas de snacks", "Spicy corn snack"],
    ]);
  });
});

describe("archivos .gz", () => {
  it("descomprime al vuelo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "off-test-"));
    try {
      const gz = join(dir, "sample.jsonl.gz");
      await pipeline(
        Readable.from([
          '{"code":"7806666666666","product_name":"Yogur","countries_tags":["en:chile"],"nutriments":{"energy-kcal_100g":62}}\n',
        ]),
        createGzip(),
        createWriteStream(gz),
      );
      const items = await collect(gz);
      expect(items).toHaveLength(1);
      expect(items[0].ok && items[0].product.code).toBe("7806666666666");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formato actual de OFF (nutrition.aggregated_set, nutriments vacío)", () => {
  it("lee kcal directas y deriva kcal desde kJ cuando solo hay kJ", async () => {
    const { loaded, foods } = await run(join(FIXTURES, "real-nutrition.jsonl"), [
      CHILE_TAG,
    ]);
    expect(loaded).toEqual(["0021000026326", "7802000010880"]);
    const mayo = foods.find((f) => f.barcode === "0021000026326")!;
    expect(mayo.kcalDesdeKj).toBe(false);
    expect(mayo.nutrients["energy_kcal"]).toBeCloseTo(642.9, 1);
    const papas = foods.find((f) => f.barcode === "7802000010880")!;
    expect(papas.kcalDesdeKj).toBe(true);
    expect(papas.nutrients["energy_kcal"]).toBeCloseTo(2240 / 4.184, 1);
  });
});
