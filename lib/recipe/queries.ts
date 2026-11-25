import "server-only";

import { createClient } from "@/lib/db/server";
import { isUuid } from "@/lib/meal/schema";

export interface RecipeListItem {
  id: string;
  foodId: string;
  name: string;
  cookedWeightG: number;
  servings: number | null;
}

export interface RecipeDetail extends RecipeListItem {
  ingredients: { foodId: string; name: string; brand: string | null; grams: number }[];
}

/** Recetas del usuario (la RLS limita a las propias), las más recientes primero. */
export async function listRecipes(): Promise<RecipeListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe")
    .select("id, food_id, name, cooked_weight_g, servings")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron leer tus recetas.");
  return data.map((r) => ({
    id: r.id,
    foodId: r.food_id,
    name: r.name,
    cookedWeightG: Number(r.cooked_weight_g),
    servings: r.servings === null ? null : Number(r.servings),
  }));
}

/** Receta propia con sus ingredientes, o null si no existe. */
export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe")
    .select(
      "id, food_id, name, cooked_weight_g, servings, recipe_ingredient (food_id, grams, food (name_es, brand))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la receta.");
  if (!data) return null;
  return {
    id: data.id,
    foodId: data.food_id,
    name: data.name,
    cookedWeightG: Number(data.cooked_weight_g),
    servings: data.servings === null ? null : Number(data.servings),
    ingredients: data.recipe_ingredient.map((i) => ({
      foodId: i.food_id,
      name: i.food?.name_es ?? "Alimento",
      brand: i.food?.brand ?? null,
      grams: Number(i.grams),
    })),
  };
}

/** Id de la receta que generó un alimento (para enlazar a su edición), si existe. */
export async function getRecipeIdByFood(foodId: string): Promise<string | null> {
  if (!isUuid(foodId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe")
    .select("id")
    .eq("food_id", foodId)
    .maybeSingle();
  return data?.id ?? null;
}
