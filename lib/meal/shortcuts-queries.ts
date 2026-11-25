import "server-only";

import { createClient } from "@/lib/db/server";

import {
  favoritesToQuick,
  pickRecents,
  type CopySourceEntry,
  type QuickFood,
  type RecentRow,
} from "./shortcuts";
import { dayRange } from "@/lib/weight/entries";

/** Ítems registrados más recientes (la RLS limita a los del usuario). */
async function listRecentRows(limit = 150): Promise<RecentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_item")
    .select(
      "food_id, quantity, unit, portion_id, grams_resolved, created_at, food (name_es, brand, basis), food_portion (label_es)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se pudieron leer tus recientes.");
  return data;
}

/** Favoritos y recientes del usuario, con la última cantidad usada de cada alimento. */
export async function listQuickFoods(
  userId: string,
): Promise<{ favorites: QuickFood[]; recents: QuickFood[] }> {
  const supabase = await createClient();
  const [rows, favs] = await Promise.all([
    listRecentRows(),
    supabase
      .from("favorite_food")
      .select("food_id, food (name_es, brand, basis)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (favs.error) throw new Error("No se pudieron leer tus favoritos.");
  return {
    favorites: favoritesToQuick(favs.data, rows),
    recents: pickRecents(rows),
  };
}

/** Ids de los alimentos favoritos del usuario. */
export async function listFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorite_food")
    .select("food_id")
    .eq("user_id", userId);
  if (error) throw new Error("No se pudieron leer tus favoritos.");
  return new Set(data.map((row) => row.food_id));
}

/** Comidas de un día con la instantánea completa de sus ítems, para copiarlas. */
export async function listDayForCopy(
  userId: string,
  day: string,
): Promise<CopySourceEntry[]> {
  const { from, to } = dayRange(day);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_entry")
    .select(
      "meal_type, meal_item (food_id, quantity, unit, portion_id, grams_resolved, kcal, kcal_estimated, protein_g, carb_g, fat_g, nutrients, created_at)",
    )
    .eq("user_id", userId)
    .gte("eaten_at", from)
    .lt("eaten_at", to);
  if (error) throw new Error("No se pudieron leer tus comidas.");
  return data;
}
