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

/** Producto desde un objeto JSON de OFF (nutriments anidado, countries_tags como arreglo). */
export function productFromJson(obj: Record<string, unknown>): OffRawProduct {
  const source =
    obj["nutriments"] && typeof obj["nutriments"] === "object"
      ? (obj["nutriments"] as Record<string, unknown>)
      : {};
  const nutriments: OffRawProduct["nutriments"] = {};
  for (const key of NUTRIMENT_KEYS) nutriments[key] = parseNumber(source[key]);
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
