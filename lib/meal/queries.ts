import "server-only";

import { createClient } from "@/lib/db/server";
import { dayRange } from "@/lib/weight/entries";

import type { DayEntryRow } from "./day";
import { isUuid } from "./schema";
import { toBasis, type FoodForLogging } from "./snapshot";

export interface FoodDetail extends FoodForLogging {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  state: string;
  source: string;
  /** Países del producto (ISO alfa-2); null = sin país (USDA, propios, recetas). */
  countries: string[] | null;
  portions: { id: string; label: string; grams: number }[];
  /** Nutrientes informados con nombre y unidad, en el orden del catálogo. */
  nutrientList: { code: string; name: string; unit: string; per100: number }[];
}

/**
 * Lee un alimento visible para el usuario (la RLS filtra públicos y propios) con sus
 * nutrientes por 100 y sus porciones. null si no existe o no es visible.
 */
export async function getFoodForLogging(id: string): Promise<FoodDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food")
    .select(
      "id, name_es, brand, category, state, basis, density_g_ml, source, countries, food_nutrient (amount_per_100, nutrient (code, name_es, unit, sort_order)), food_portion (id, label_es, grams)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el alimento.");
  if (!data) return null;

  const nutrientList = data.food_nutrient
    .flatMap((fn) =>
      fn.nutrient
        ? [
            {
              code: fn.nutrient.code,
              name: fn.nutrient.name_es,
              unit: fn.nutrient.unit,
              per100: Number(fn.amount_per_100),
              sort: fn.nutrient.sort_order,
            },
          ]
        : [],
    )
    .sort((a, b) => a.sort - b.sort)
    .map(({ code, name, unit, per100 }) => ({ code, name, unit, per100 }));

  return {
    id: data.id,
    name: data.name_es,
    brand: data.brand,
    category: data.category,
    state: data.state,
    source: data.source,
    countries: data.countries,
    basis: toBasis(data.basis),
    densityGMl: data.density_g_ml === null ? null : Number(data.density_g_ml),
    per100: Object.fromEntries(nutrientList.map((n) => [n.code, n.per100])),
    portions: data.food_portion
      .map((p) => ({ id: p.id, label: p.label_es, grams: Number(p.grams) }))
      .sort((a, b) => a.grams - b.grams),
    nutrientList,
  };
}

/** Registros de comida de un día (AAAA-MM-DD) con sus ítems, alimento y porción. */
export async function listDayMeals(userId: string, day: string): Promise<DayEntryRow[]> {
  const { from, to } = dayRange(day);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_entry")
    .select(
      "id, meal_type, meal_item (id, quantity, unit, grams_resolved, kcal, kcal_estimated, protein_g, carb_g, fat_g, created_at, food (name_es, brand, source), food_portion (label_es))",
    )
    .eq("user_id", userId)
    .gte("eaten_at", from)
    .lt("eaten_at", to)
    .order("eaten_at");
  if (error) throw new Error("No se pudieron leer tus comidas.");
  return data;
}
