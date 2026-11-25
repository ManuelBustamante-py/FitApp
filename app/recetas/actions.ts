"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { toBasis } from "@/lib/meal/snapshot";
import { computeRecipePer100, servingGrams } from "@/lib/recipe/compute";
import {
  parseRecipeForm,
  type RecipeFieldErrors,
  type RecipeValues,
} from "@/lib/recipe/schema";
import { isUuid } from "@/lib/meal/schema";
import { searchFoods } from "@/lib/food/search-queries";
import { getUserCountry } from "@/lib/profile/country-queries";

export type RecipeFormState =
  { status: "idle" } | { status: "error"; message?: string; errors?: RecipeFieldErrors };

const SAVE_ERROR: RecipeFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

export interface IngredientOption {
  id: string;
  name: string;
  brand: string | null;
  kcalPer100: number | null;
}

/** Busca alimentos (catálogo y propios) para usarlos como ingredientes. */
export async function searchIngredients(query: string): Promise<IngredientOption[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const foods = await searchFoods(String(query ?? ""), 15, await getUserCountry(user.id));
  return foods.map((f) => ({
    id: f.id,
    name: f.name_es,
    brand: f.brand,
    kcalPer100: f.kcal_per_100,
  }));
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lee los ingredientes (visibles para el usuario) y calcula los nutrientes por 100 g. */
async function computeFromDb(
  supabase: Supabase,
  values: RecipeValues,
  ownFoodId?: string,
) {
  const ids = values.ingredients.map((i) => i.foodId);
  if (ownFoodId && ids.includes(ownFoodId))
    return { error: "Una receta no puede ser ingrediente de sí misma." } as const;
  const { data, error } = await supabase
    .from("food")
    .select(
      "id, name_es, basis, density_g_ml, food_nutrient (amount_per_100, nutrient (code))",
    )
    .in("id", ids);
  if (error) return { error: "No se pudieron leer los ingredientes." } as const;
  const byId = new Map(data.map((f) => [f.id, f]));
  const inputs = [];
  for (const { foodId, grams } of values.ingredients) {
    const food = byId.get(foodId);
    if (!food) return { error: "Un ingrediente ya no está disponible." } as const;
    const per100: Record<string, number> = {};
    for (const fn of food.food_nutrient)
      if (fn.nutrient) per100[fn.nutrient.code] = Number(fn.amount_per_100);
    inputs.push({
      name: food.name_es,
      basis: toBasis(food.basis),
      densityGMl: food.density_g_ml === null ? null : Number(food.density_g_ml),
      per100,
      grams,
    });
  }
  const result = computeRecipePer100(inputs, values.cookedWeightG);
  if (!result.ok) return { error: result.message } as const;
  const codes = Object.keys(result.per100);
  const { data: catalog, error: catalogError } = await supabase
    .from("nutrient")
    .select("id, code")
    .in("code", codes);
  if (catalogError || catalog.length !== codes.length)
    return { error: "No se pudieron leer los nutrientes." } as const;
  return {
    rows: catalog.map((n) => ({
      nutrient_id: n.id,
      amount_per_100: result.per100[n.code],
    })),
  } as const;
}

async function parseAndCompute(
  supabase: Supabase,
  formData: FormData,
  ownFoodId?: string,
) {
  const parsed = parseRecipeForm(formData);
  if (!parsed.success)
    return { state: { status: "error", errors: parsed.errors } as RecipeFormState };
  const computed = await computeFromDb(supabase, parsed.data, ownFoodId);
  if ("error" in computed)
    return { state: { status: "error", message: computed.error } as RecipeFormState };
  return { values: parsed.data, rows: computed.rows };
}

const portionLabel = (grams: number) => `1 porción (${grams} g)`.replace(".", ",");

/**
 * Crea una receta (RF-20): un alimento propio (`source = 'recipe'`) con los nutrientes por
 * 100 g de la preparación cocida, la receta y sus ingredientes. Si se indicó el número de
 * porciones, se crea una porción de peso cocido / porciones. Si falla un paso se borra el
 * alimento (la receta, los nutrientes y las porciones caen en cascada).
 */
export async function createRecipe(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const result = await parseAndCompute(supabase, formData);
  if (!result.values) return result.state;
  const { values, rows } = result;

  const { data: food, error: foodError } = await supabase
    .from("food")
    .insert({
      name_es: values.name,
      category: "Receta",
      state: "cocido",
      basis: "per_100g",
      source: "recipe",
      owner_user_id: user.id,
    })
    .select("id")
    .single();
  if (foodError) return SAVE_ERROR;
  const rollback = async () => {
    await supabase.from("food").delete().eq("id", food.id);
    return SAVE_ERROR;
  };

  const { error: nutrientError } = await supabase
    .from("food_nutrient")
    .insert(rows.map((r) => ({ ...r, food_id: food.id })));
  if (nutrientError) return rollback();

  if (values.servings !== null) {
    const { error } = await supabase.from("food_portion").insert({
      food_id: food.id,
      label_es: portionLabel(servingGrams(values.cookedWeightG, values.servings)),
      grams: servingGrams(values.cookedWeightG, values.servings),
    });
    if (error) return rollback();
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipe")
    .insert({
      user_id: user.id,
      name: values.name,
      cooked_weight_g: values.cookedWeightG,
      servings: values.servings,
      food_id: food.id,
    })
    .select("id")
    .single();
  if (recipeError) return rollback();

  const { error: ingredientError } = await supabase.from("recipe_ingredient").insert(
    values.ingredients.map((i) => ({
      recipe_id: recipe.id,
      food_id: i.foodId,
      grams: i.grams,
    })),
  );
  if (ingredientError) return rollback();

  revalidatePath("/recetas");
  revalidatePath("/alimentos");
  redirect(`/alimentos/${food.id}`);
}

/**
 * Edita una receta propia: recalcula los nutrientes por 100 g del alimento generado y
 * reemplaza sus ingredientes. Los registros de comida ya guardados no cambian (tienen su
 * propia instantánea de nutrientes, #16).
 */
export async function updateRecipe(
  recipeId: string,
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isUuid(recipeId)) return SAVE_ERROR;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipe")
    .select("id, food_id")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return { status: "error", message: "No encontramos la receta." };

  const result = await parseAndCompute(supabase, formData, recipe.food_id);
  if (!result.values) return result.state;
  const { values, rows } = result;

  const steps = [
    supabase.from("food").update({ name_es: values.name }).eq("id", recipe.food_id),
    supabase.from("food_nutrient").delete().eq("food_id", recipe.food_id),
  ];
  for (const step of steps) if ((await step).error) return SAVE_ERROR;
  const { error: nutrientError } = await supabase
    .from("food_nutrient")
    .insert(rows.map((r) => ({ ...r, food_id: recipe.food_id })));
  if (nutrientError) return SAVE_ERROR;

  // La porción se actualiza en su lugar para no soltar el vínculo de registros previos.
  const { data: portion } = await supabase
    .from("food_portion")
    .select("id")
    .eq("food_id", recipe.food_id)
    .limit(1)
    .maybeSingle();
  if (values.servings === null) {
    if (portion) await supabase.from("food_portion").delete().eq("id", portion.id);
  } else {
    const grams = servingGrams(values.cookedWeightG, values.servings);
    const fields = { label_es: portionLabel(grams), grams };
    const { error } = portion
      ? await supabase.from("food_portion").update(fields).eq("id", portion.id)
      : await supabase
          .from("food_portion")
          .insert({ ...fields, food_id: recipe.food_id });
    if (error) return SAVE_ERROR;
  }

  const { error: recipeError } = await supabase
    .from("recipe")
    .update({
      name: values.name,
      cooked_weight_g: values.cookedWeightG,
      servings: values.servings,
    })
    .eq("id", recipe.id);
  if (recipeError) return SAVE_ERROR;

  const { error: deleteError } = await supabase
    .from("recipe_ingredient")
    .delete()
    .eq("recipe_id", recipe.id);
  if (deleteError) return SAVE_ERROR;
  const { error: ingredientError } = await supabase.from("recipe_ingredient").insert(
    values.ingredients.map((i) => ({
      recipe_id: recipe.id,
      food_id: i.foodId,
      grams: i.grams,
    })),
  );
  if (ingredientError) return SAVE_ERROR;

  revalidatePath("/recetas");
  revalidatePath(`/alimentos/${recipe.food_id}`);
  redirect(`/alimentos/${recipe.food_id}`);
}
