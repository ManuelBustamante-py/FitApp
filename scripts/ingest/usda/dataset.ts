/**
 * Lectura de las descargas CSV de USDA FoodData Central (carpetas descomprimidas).
 * Lee en streaming y conserva solo lo necesario: alimentos de los tipos
 * importados, los nutrientes mapeados y sus porciones.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readCsvRecords } from "../lib/csv.ts";

import { sourceForDataType, type UsdaFood } from "./normalize.ts";
import {
  buildNutrientIndex,
  RELEVANT_USDA_NUMBERS,
  type UsdaNutrientDef,
} from "./nutrients.ts";

/** Devuelve las carpetas con food.csv: la ruta dada o sus subcarpetas (hasta 2 niveles). */
export function findDatasetDirs(root: string): string[] {
  if (!existsSync(root)) throw new Error(`No existe la carpeta ${root}`);
  if (existsSync(join(root, "food.csv"))) return [root];
  const found: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    if (!statSync(path).isDirectory()) continue;
    found.push(...findDatasetDirsShallow(path));
  }
  return found;
}

function findDatasetDirsShallow(dir: string): string[] {
  if (existsSync(join(dir, "food.csv"))) return [dir];
  return readdirSync(dir)
    .sort()
    .map((entry) => join(dir, entry))
    .filter((path) => statSync(path).isDirectory() && existsSync(join(path, "food.csv")));
}

async function readMap(
  path: string,
  key: string,
  value: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  for await (const record of readCsvRecords(path)) map.set(record[key], record[value]);
  return map;
}

export interface FoodName {
  fdcId: string;
  dataType: string;
  description: string;
}

/** Solo los nombres de los alimentos importables (para el generador de traducciones). */
export async function readFoodNames(dir: string): Promise<FoodName[]> {
  const names: FoodName[] = [];
  for await (const record of readCsvRecords(join(dir, "food.csv"))) {
    if (!sourceForDataType(record.data_type)) continue;
    names.push({
      fdcId: record.fdc_id,
      dataType: record.data_type,
      description: record.description.trim(),
    });
  }
  return names;
}

/** Lee una carpeta de descarga completa y arma los alimentos con nutrientes y porciones. */
export async function readDataset(dir: string): Promise<UsdaFood[]> {
  const nutrientDefs: UsdaNutrientDef[] = [];
  for await (const r of readCsvRecords(join(dir, "nutrient.csv"))) {
    nutrientDefs.push({ id: r.id, nutrientNbr: r.nutrient_nbr, unitName: r.unit_name });
  }
  const nutrientIndex = buildNutrientIndex(nutrientDefs);
  const measureUnits = await readMap(join(dir, "measure_unit.csv"), "id", "name");
  const categories = await readMap(join(dir, "food_category.csv"), "id", "description");
  const wweia = await readMap(
    join(dir, "wweia_food_category.csv"),
    "wweia_food_category",
    "wweia_food_category_description",
  );

  const foods = new Map<string, UsdaFood>();
  for await (const r of readCsvRecords(join(dir, "food.csv"))) {
    if (!sourceForDataType(r.data_type)) continue;
    const categoryId = r.food_category_id;
    const categoryEn =
      r.data_type === "survey_fndds_food"
        ? (wweia.get(categoryId) ?? null)
        : (categories.get(categoryId) ?? null);
    foods.set(r.fdc_id, {
      fdcId: r.fdc_id,
      dataType: r.data_type,
      description: r.description.trim(),
      categoryEn,
      nutrients: [],
      portions: [],
    });
  }

  for await (const r of readCsvRecords(join(dir, "food_nutrient.csv"))) {
    const food = foods.get(r.fdc_id);
    if (!food) continue;
    const resolved = nutrientIndex.get(r.nutrient_id);
    if (!resolved || !RELEVANT_USDA_NUMBERS.has(resolved.nutrientNbr)) continue;
    const amount = Number(r.amount);
    if (r.amount === "" || !Number.isFinite(amount)) continue;
    food.nutrients.push({ ...resolved, amount });
  }

  const portionsPath = join(dir, "food_portion.csv");
  if (existsSync(portionsPath)) {
    for await (const r of readCsvRecords(portionsPath)) {
      const food = foods.get(r.fdc_id);
      if (!food) continue;
      food.portions.push({
        id: r.id,
        amount: r.amount,
        measureUnitName: measureUnits.get(r.measure_unit_id) ?? "",
        portionDescription: r.portion_description,
        modifier: r.modifier,
        gramWeight: r.gram_weight,
        seqNum: r.seq_num,
      });
    }
  }

  for (const food of foods.values()) {
    food.portions.sort(
      (a, b) =>
        (Number(a.seqNum) || 0) - (Number(b.seqNum) || 0) || Number(a.id) - Number(b.id),
    );
  }
  return [...foods.values()];
}
