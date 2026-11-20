/**
 * Carga de Open Food Facts en Supabase (clave secreta, omite la RLS), idempotente:
 *
 * - food: id determinista (UUID v5 del código de barras), así que basta un upsert
 *   por id; reimportar actualiza la misma fila (source = 'off', source_id = código).
 * - food_nutrient: se borran y se vuelven a insertar las filas de cada producto.
 *
 * Reutiliza el cliente y utilidades de la carga de USDA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../lib/db/database.types.ts";
import { uuidV5 } from "../lib/uuid.ts";
import { chunk } from "../usda/load.ts";

import { OFF_LICENSE, OFF_SOURCE, type OffFood } from "./normalize.ts";

type Db = SupabaseClient<Database>;
type FoodInsert = Database["public"]["Tables"]["food"]["Insert"];
type FoodNutrientInsert = Database["public"]["Tables"]["food_nutrient"]["Insert"];

/** Espacio de nombres fijo para los ids de food importados de Open Food Facts. */
export const OFF_FOOD_NAMESPACE = "9d4c1a7e-6b2f-4f0a-8e35-2c7d5b1a90f4";

const FILTER_CHUNK = 100;

export function foodId(barcode: string): string {
  return uuidV5(`${OFF_SOURCE}:${barcode}`, OFF_FOOD_NAMESPACE);
}

export function buildFoodRow(food: OffFood, importedAt: string): FoodInsert {
  return {
    id: foodId(food.barcode),
    name_es: food.nameEs,
    name_en: null,
    brand: food.brand,
    barcode: food.barcode,
    category: null,
    state: "na",
    basis: food.basis,
    density_g_ml: null,
    source: OFF_SOURCE,
    source_id: food.barcode,
    license: OFF_LICENSE,
    owner_user_id: null,
    imported_at: importedAt,
  };
}

export function buildNutrientRows(
  food: OffFood,
  nutrientIds: ReadonlyMap<string, number>,
): FoodNutrientInsert[] {
  const id = foodId(food.barcode);
  return Object.entries(food.nutrients)
    .filter(([code]) => nutrientIds.has(code))
    .map(([code, amount]) => ({
      food_id: id,
      nutrient_id: nutrientIds.get(code)!,
      amount_per_100: amount,
    }))
    .sort((a, b) => a.nutrient_id - b.nutrient_id);
}

async function writeBatch(
  db: Db,
  foods: readonly OffFood[],
  nutrientIds: ReadonlyMap<string, number>,
  importedAt: string,
): Promise<void> {
  const { error: foodError } = await db.from("food").upsert(
    foods.map((f) => buildFoodRow(f, importedAt)),
    { onConflict: "id" },
  );
  if (foodError) throw new Error(`upsert food: ${foodError.message}`);

  for (const part of chunk(
    foods.map((f) => foodId(f.barcode)),
    FILTER_CHUNK,
  )) {
    const { error } = await db.from("food_nutrient").delete().in("food_id", part);
    if (error) throw new Error(`borrar food_nutrient: ${error.message}`);
  }
  const rows = foods.flatMap((f) => buildNutrientRows(f, nutrientIds));
  if (rows.length > 0) {
    const { error } = await db.from("food_nutrient").insert(rows);
    if (error) throw new Error(`insertar food_nutrient: ${error.message}`);
  }
}

export interface OffLoadError {
  barcode: string;
  name: string;
  error: string;
}

/**
 * Escribe los productos en lotes. Si un lote falla, se reintenta producto por
 * producto para aislar las filas con error; el resto se carga igual.
 */
export async function loadOffFoods(
  db: Db,
  foods: readonly OffFood[],
  options: {
    nutrientIds: ReadonlyMap<string, number>;
    batchSize: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ loaded: number; errors: OffLoadError[] }> {
  const importedAt = new Date().toISOString();
  const errors: OffLoadError[] = [];
  let loaded = 0;
  let done = 0;
  for (const batch of chunk(foods, options.batchSize)) {
    try {
      await writeBatch(db, batch, options.nutrientIds, importedAt);
      loaded += batch.length;
    } catch {
      for (const food of batch) {
        try {
          await writeBatch(db, [food], options.nutrientIds, importedAt);
          loaded++;
        } catch (error) {
          errors.push({
            barcode: food.barcode,
            name: food.nameEs,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    done += batch.length;
    options.onProgress?.(done, foods.length);
  }
  return { loaded, errors };
}
