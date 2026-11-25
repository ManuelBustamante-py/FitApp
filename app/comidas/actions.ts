"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { MEAL_TYPE_LABELS } from "@/lib/meal/meal-types";
import { getFoodForLogging } from "@/lib/meal/queries";
import { isUuid, parseMealItemForm, type MealItemFieldErrors } from "@/lib/meal/schema";
import { buildMealItemSnapshot } from "@/lib/meal/snapshot";
import { dayRange, dayToTimestamp, todayIn } from "@/lib/weight/entries";

export interface MealItemSummary {
  foodName: string;
  mealLabel: string;
  date: string;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export type MealItemFormState =
  | { status: "idle" }
  | { status: "saved"; summary: MealItemSummary }
  | { status: "error"; message?: string; errors?: MealItemFieldErrors };

const SAVE_ERROR: MealItemFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

/**
 * Registra un alimento en una comida (RF-16, RF-17). La instantánea de nutrientes se
 * calcula aquí con el alimento leído desde la base (no se confía en el cliente) y se
 * guarda en `meal_item`: editar el alimento después no cambia el registro.
 * Se reutiliza el `meal_entry` del mismo día y tipo de comida, o se crea uno.
 */
export async function saveMealItem(
  _prev: MealItemFormState,
  formData: FormData,
): Promise<MealItemFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return SAVE_ERROR;
  if (!profile) redirect("/onboarding");

  const parsed = parseMealItemForm(formData, todayIn(profile.timezone));
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const values = parsed.data;

  let food;
  try {
    food = await getFoodForLogging(values.foodId);
  } catch {
    return SAVE_ERROR;
  }
  if (!food) return { status: "error", message: "El alimento ya no está disponible." };

  const result = buildMealItemSnapshot(food, values);
  if (!result.ok)
    return { status: "error", errors: result.errors, message: result.message };
  const { snapshot } = result;

  const { from, to } = dayRange(values.date);
  const { data: existing, error: existingError } = await supabase
    .from("meal_entry")
    .select("id")
    .eq("user_id", user.id)
    .eq("meal_type", values.mealType)
    .gte("eaten_at", from)
    .lt("eaten_at", to)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existingError) return SAVE_ERROR;

  let entryId = existing?.id ?? null;
  if (!entryId) {
    const { data: created, error } = await supabase
      .from("meal_entry")
      .insert({
        user_id: user.id,
        meal_type: values.mealType,
        eaten_at: dayToTimestamp(values.date),
      })
      .select("id")
      .single();
    if (error) return SAVE_ERROR;
    entryId = created.id;
  }

  const { error: itemError } = await supabase.from("meal_item").insert({
    meal_entry_id: entryId,
    food_id: food.id,
    ...snapshot,
  });
  if (itemError) {
    // No deja una comida vacía si el ítem no se pudo guardar.
    if (!existing) await supabase.from("meal_entry").delete().eq("id", entryId);
    return SAVE_ERROR;
  }

  revalidatePath("/comidas");
  return {
    status: "saved",
    summary: {
      foodName: food.name,
      mealLabel: MEAL_TYPE_LABELS[values.mealType],
      date: values.date,
      kcal: snapshot.kcal,
      proteinG: snapshot.protein_g,
      carbG: snapshot.carb_g,
      fatG: snapshot.fat_g,
    },
  };
}

/**
 * Elimina un ítem de comida del usuario (la RLS solo deja borrar los propios) y, si
 * su comida queda vacía, también la comida.
 */
export async function deleteMealItem(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id");
  if (!isUuid(id)) return;

  const supabase = await createClient();
  const { data: deleted } = await supabase
    .from("meal_item")
    .delete()
    .eq("id", id)
    .select("meal_entry_id")
    .maybeSingle();

  if (deleted) {
    const { count } = await supabase
      .from("meal_item")
      .select("id", { count: "exact", head: true })
      .eq("meal_entry_id", deleted.meal_entry_id);
    if (count === 0)
      await supabase
        .from("meal_entry")
        .delete()
        .eq("id", deleted.meal_entry_id)
        .eq("user_id", user.id);
  }
  revalidatePath("/comidas");
}
