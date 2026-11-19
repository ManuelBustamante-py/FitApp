/**
 * Carga en Supabase (clave secreta, omite la RLS) de forma idempotente:
 *
 * - food: se busca el id existente por (source, source_id) y se hace upsert por id.
 *   (El índice único (source, source_id) es parcial, y PostgREST no puede usarlo
 *   como destino de ON CONFLICT; por eso se resuelve el id antes.)
 * - food_nutrient: se borran y se vuelven a insertar las filas del alimento.
 * - food_portion: id determinista (UUID v5 de fuente + id de porción USDA), upsert
 *   por id y borrado de las porciones que ya no vienen. Así los meal_item que
 *   apuntan a una porción la conservan entre reimportaciones.
 */

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../lib/db/database.types.ts";
import { uuidV5 } from "../lib/uuid.ts";

import type { NormalizedFood } from "./normalize.ts";

type Db = SupabaseClient<Database>;
type FoodInsert = Database["public"]["Tables"]["food"]["Insert"];
type FoodNutrientInsert = Database["public"]["Tables"]["food_nutrient"]["Insert"];
type FoodPortionInsert = Database["public"]["Tables"]["food_portion"]["Insert"];

/** Espacio de nombres fijo para los ids de food_portion importados de USDA. */
export const USDA_PORTION_NAMESPACE = "5b0c3f62-3b0e-4d52-9a57-6f1f3c1e7a21";

/** Tamaño de los filtros `in (...)` para no exceder el largo de URL. */
const FILTER_CHUNK = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError("size debe ser >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Crea el cliente con la clave secreta desde variables de entorno. */
export function createServiceClient(
  env: Record<string, string | undefined> = process.env,
): Db {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) y " +
        "SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY). Ver scripts/ingest/README.md.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadNutrientIds(db: Db): Promise<Map<string, number>> {
  const { data, error } = await db.from("nutrient").select("id, code");
  if (error) throw new Error(`No se pudo leer public.nutrient: ${error.message}`);
  return new Map(data.map((n) => [n.code, n.id]));
}

export function portionId(food: NormalizedFood, sourcePortionId: string): string {
  return uuidV5(
    `${food.source}:${food.sourceId}:${sourcePortionId}`,
    USDA_PORTION_NAMESPACE,
  );
}

export function buildFoodRow(
  food: NormalizedFood,
  id: string,
  importedAt: string,
): FoodInsert {
  return {
    id,
    name_es: food.nameEs,
    name_en: food.nameEn,
    brand: null,
    barcode: null,
    category: food.category,
    state: food.state,
    basis: food.basis,
    density_g_ml: null,
    source: food.source,
    source_id: food.sourceId,
    license: food.license,
    owner_user_id: null,
    imported_at: importedAt,
  };
}

export function buildNutrientRows(
  food: NormalizedFood,
  foodId: string,
  nutrientIds: ReadonlyMap<string, number>,
): FoodNutrientInsert[] {
  return Object.entries(food.nutrients)
    .filter(([code]) => nutrientIds.has(code))
    .map(([code, amount]) => ({
      food_id: foodId,
      nutrient_id: nutrientIds.get(code)!,
      amount_per_100: amount,
    }))
    .sort((a, b) => a.nutrient_id - b.nutrient_id);
}

export function buildPortionRows(
  food: NormalizedFood,
  foodId: string,
): FoodPortionInsert[] {
  return food.portions.map((p) => ({
    id: portionId(food, p.sourcePortionId),
    food_id: foodId,
    label_es: p.labelEs,
    grams: p.grams,
  }));
}

async function existingFoodIds(db: Db, foods: readonly NormalizedFood[]) {
  const ids = new Map<string, string>();
  const bySource = new Map<string, string[]>();
  for (const f of foods) {
    bySource.set(f.source, [...(bySource.get(f.source) ?? []), f.sourceId]);
  }
  for (const [source, sourceIds] of bySource) {
    for (const part of chunk(sourceIds, FILTER_CHUNK)) {
      const { data, error } = await db
        .from("food")
        .select("id, source_id")
        .eq("source", source)
        .in("source_id", part);
      if (error) throw new Error(`buscar food existentes: ${error.message}`);
      for (const row of data) ids.set(`${source}:${row.source_id}`, row.id);
    }
  }
  return ids;
}

async function writeBatch(
  db: Db,
  foods: readonly NormalizedFood[],
  nutrientIds: ReadonlyMap<string, number>,
  importedAt: string,
): Promise<void> {
  const existing = await existingFoodIds(db, foods);
  const withIds = foods.map((food) => ({
    food,
    id: existing.get(`${food.source}:${food.sourceId}`) ?? randomUUID(),
  }));
  const foodIds = withIds.map((f) => f.id);

  const { error: foodError } = await db.from("food").upsert(
    withIds.map(({ food, id }) => buildFoodRow(food, id, importedAt)),
    { onConflict: "id" },
  );
  if (foodError) throw new Error(`upsert food: ${foodError.message}`);

  for (const part of chunk(foodIds, FILTER_CHUNK)) {
    const { error } = await db.from("food_nutrient").delete().in("food_id", part);
    if (error) throw new Error(`borrar food_nutrient: ${error.message}`);
  }
  const nutrientRows = withIds.flatMap(({ food, id }) =>
    buildNutrientRows(food, id, nutrientIds),
  );
  if (nutrientRows.length > 0) {
    const { error } = await db.from("food_nutrient").insert(nutrientRows);
    if (error) throw new Error(`insertar food_nutrient: ${error.message}`);
  }

  const portionRows = withIds.flatMap(({ food, id }) => buildPortionRows(food, id));
  if (portionRows.length > 0) {
    const { error } = await db
      .from("food_portion")
      .upsert(portionRows, { onConflict: "id" });
    if (error) throw new Error(`upsert food_portion: ${error.message}`);
  }
  const keep = new Set(portionRows.map((p) => p.id));
  for (const part of chunk(foodIds, FILTER_CHUNK)) {
    const { data, error } = await db
      .from("food_portion")
      .select("id")
      .in("food_id", part);
    if (error) throw new Error(`leer food_portion: ${error.message}`);
    const stale = data.map((p) => p.id).filter((pid) => !keep.has(pid));
    for (const staleIds of chunk(stale, FILTER_CHUNK)) {
      const { error: delError } = await db
        .from("food_portion")
        .delete()
        .in("id", staleIds);
      if (delError) throw new Error(`borrar food_portion obsoletas: ${delError.message}`);
    }
  }
}

export interface LoadError {
  source: string;
  sourceId: string;
  nameEn: string;
  error: string;
}

/**
 * Escribe los alimentos en lotes. Si un lote falla, se reintenta alimento por
 * alimento para aislar las filas con error; el resto se carga igual.
 */
export async function loadFoods(
  db: Db,
  foods: readonly NormalizedFood[],
  options: {
    nutrientIds: ReadonlyMap<string, number>;
    batchSize: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<{ loaded: number; errors: LoadError[] }> {
  const importedAt = new Date().toISOString();
  const errors: LoadError[] = [];
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
            source: food.source,
            sourceId: food.sourceId,
            nameEn: food.nameEn,
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
