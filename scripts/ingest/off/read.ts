/**
 * Lectura en streaming de los exports de Open Food Facts.
 *
 * - CSV de OFF: en realidad separado por tabuladores, sin comillas ni saltos de
 *   línea dentro de los campos (en.openfoodfacts.org.products.csv[.gz]).
 * - JSONL (openfoodfacts-products.jsonl[.gz]): un producto por línea.
 *
 * Se lee línea a línea (nunca el archivo entero) y los .gz se descomprimen al vuelo.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

import { parseNumber, splitTags, type OffRawProduct } from "./normalize.ts";

/** Claves de nutrientes (por 100 g) que se extraen de cada producto. */
export const NUTRIMENT_KEYS = [
  "energy-kcal_100g",
  "energy-kj_100g",
  "energy_100g",
  "proteins_100g",
  "fat_100g",
  "saturated-fat_100g",
  "trans-fat_100g",
  "carbohydrates_100g",
  "sugars_100g",
  "fiber_100g",
  "salt_100g",
  "sodium_100g",
  "cholesterol_100g",
  "alcohol_100g",
] as const;

export type ReadItem =
  { ok: true; product: OffRawProduct } | { ok: false; line: number; error: string };

export type OffFormat = "tsv" | "jsonl";

export function detectFormat(path: string): OffFormat {
  const base = path.toLowerCase().replace(/\.gz$/, "");
  if (/\.(jsonl|ndjson|json)$/.test(base)) return "jsonl";
  if (/\.(csv|tsv)$/.test(base)) return "tsv";
  throw new Error(
    `Formato no reconocido: ${path} (se esperaba .csv, .tsv o .jsonl, con .gz opcional)`,
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** Lista de etiquetas de OFF: arreglo JSON o texto separado por comas. */
function tagList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((t) => asString(t).trim().toLowerCase()).filter(Boolean)
    : splitTags(asString(value));
}

/** Producto desde una fila del CSV/TSV (columnas por nombre de encabezado). */
export function productFromRecord(record: Record<string, string>): OffRawProduct {
  const nutriments: OffRawProduct["nutriments"] = {};
  for (const key of NUTRIMENT_KEYS) nutriments[key] = parseNumber(record[key]);
  return {
    code: record["code"] ?? "",
    productName: record["product_name"] ?? "",
    productNameEs: record["product_name_es"] ?? "",
    productNameEn: record["product_name_en"] ?? "",
    genericNameEn: record["generic_name_en"] ?? "",
    categoriesTags: splitTags(record["categories_tags"] ?? ""),
    mainCategory: (record["main_category"] ?? "").trim().toLowerCase(),
    brands: record["brands"] ?? "",
    quantity: record["quantity"] ?? "",
    countriesTags: splitTags(record["countries_tags"] ?? ""),
    nutriments,
  };
}

/** Nombre de nutriente del formato nuevo de OFF → clave *_100g que espera normalize.ts. */
const NUEVO_A_CLAVE: Record<string, (typeof NUTRIMENT_KEYS)[number]> = {
  "energy-kcal": "energy-kcal_100g",
  "energy-kj": "energy-kj_100g",
  energy: "energy_100g", // en este formato "energy" viene en kJ
  proteins: "proteins_100g",
  fat: "fat_100g",
  "saturated-fat": "saturated-fat_100g",
  "trans-fat": "trans-fat_100g",
  carbohydrates: "carbohydrates_100g",
  sugars: "sugars_100g",
  fiber: "fiber_100g",
  salt: "salt_100g",
  sodium: "sodium_100g",
  cholesterol: "cholesterol_100g",
  alcohol: "alcohol_100g",
};

/** Lleva un valor a la unidad base de las claves *_100g (g; kcal y kJ no se tocan). */
function aUnidadBase(value: number, unit: unknown): number {
  const u = asString(unit).trim().toLowerCase();
  if (u === "mg") return value / 1e3;
  if (["µg", "μg", "mcg", "ug"].includes(u)) return value / 1e6;
  return value;
}

/**
 * Nutrientes por 100 g del formato actual de OFF: `nutrition.aggregated_set` (o, si
 * no viene por 100 g, el primer `input_sets` por 100 g). Cada nutriente es
 * { value, unit, ... }. En los productos actuales `nutriments` llega vacío.
 */
function nutrientesNuevos(obj: Record<string, unknown>): OffRawProduct["nutriments"] {
  const out: OffRawProduct["nutriments"] = {};
  const nutrition = obj["nutrition"];
  if (!nutrition || typeof nutrition !== "object") return out;
  const n = nutrition as Record<string, unknown>;
  const sets: unknown[] = [n["aggregated_set"]];
  if (Array.isArray(n["input_sets"])) sets.push(...n["input_sets"]);
  for (const set of sets) {
    if (!set || typeof set !== "object") continue;
    const s = set as Record<string, unknown>;
    const nutrients = s["nutrients"];
    if (s["per"] !== "100g" || !nutrients || typeof nutrients !== "object") continue;
    for (const [name, key] of Object.entries(NUEVO_A_CLAVE)) {
      const entry = (nutrients as Record<string, unknown>)[name];
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const v = parseNumber(e["value"]);
      if (v === undefined) continue;
      out[key] = Number.isNaN(v) ? v : aUnidadBase(v, e["unit"]);
    }
    if (Object.keys(out).length > 0) break;
  }
  return out;
}

/**
 * Producto desde un objeto JSON de OFF. Nutrientes: `nutriments` con claves *_100g
 * (forma antigua) y, si no aporta ninguno, `nutrition.aggregated_set` (forma actual).
 */
export function productFromJson(obj: Record<string, unknown>): OffRawProduct {
  const source =
    obj["nutriments"] && typeof obj["nutriments"] === "object"
      ? (obj["nutriments"] as Record<string, unknown>)
      : {};
  let nutriments: OffRawProduct["nutriments"] = {};
  for (const key of NUTRIMENT_KEYS) nutriments[key] = parseNumber(source[key]);
  if (!NUTRIMENT_KEYS.some((k) => nutriments[k] !== undefined)) {
    nutriments = nutrientesNuevos(obj);
  }
  const tags = obj["countries_tags"];
  return {
    code: asString(obj["code"]),
    productName: asString(obj["product_name"]),
    productNameEs: asString(obj["product_name_es"]),
    productNameEn: asString(obj["product_name_en"]),
    genericNameEn: asString(obj["generic_name_en"]),
    categoriesTags: tagList(obj["categories_tags"]),
    mainCategory: asString(obj["main_category"]).trim().toLowerCase(),
    brands: asString(obj["brands"]),
    quantity: asString(obj["quantity"]),
    countriesTags: Array.isArray(tags)
      ? tags.map((t) => asString(t).trim().toLowerCase()).filter(Boolean)
      : splitTags(asString(tags)),
    nutriments,
  };
}

/**
 * Aviso para un CSV/TSV cuyo encabezado no trae product_name_en ni product_name_es:
 * el nombre en inglés (name_en) quedará vacío. null si el encabezado sí los trae.
 */
export function avisoEncabezadoCsv(header: readonly string[]): string | null {
  if (header.includes("product_name_en") || header.includes("product_name_es")) {
    return null;
  }
  return (
    "Aviso: el CSV no trae product_name_es ni product_name_en, así que name_en quedará vacío " +
    "(el nombre sale de product_name). Para nombres en inglés usa el export JSONL " +
    "(openfoodfacts-products.jsonl.gz), recomendado."
  );
}

/** Lee productos de un stream de texto ya descomprimido. */
export async function* readOffLines(
  input: Readable,
  format: OffFormat,
): AsyncGenerator<ReadItem> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header: string[] | null = null;
  let lineNo = 0;
  for await (const line of lines) {
    lineNo++;
    if (line.trim() === "") continue;
    if (format === "tsv") {
      const cells = line.split("\t");
      if (!header) {
        header = cells.map((c, i) => (i === 0 ? c.replace(/^﻿/, "") : c));
        // Una sola vez por archivo: se avisa al leer el encabezado.
        const aviso = avisoEncabezadoCsv(header);
        if (aviso) console.warn(aviso);
        continue;
      }
      const record: Record<string, string> = {};
      header.forEach((name, i) => {
        record[name] = cells[i] ?? "";
      });
      yield { ok: true, product: productFromRecord(record) };
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        yield { ok: false, line: lineNo, error: "la línea no es un objeto JSON" };
        continue;
      }
      yield { ok: true, product: productFromJson(parsed as Record<string, unknown>) };
    } catch (error) {
      yield {
        ok: false,
        line: lineNo,
        error: `JSON inválido: ${(error as Error).message}`,
      };
    }
  }
}

/** Abre un export de OFF (CSV/TSV/JSONL, con .gz opcional) y entrega los productos. */
export function readOffFile(path: string): AsyncGenerator<ReadItem> {
  const format = detectFormat(path);
  const file = createReadStream(path, { highWaterMark: 1 << 20 });
  const stream: Readable = path.toLowerCase().endsWith(".gz")
    ? file.pipe(createGunzip())
    : file;
  stream.setEncoding("utf8");
  return readOffLines(stream, format);
}
