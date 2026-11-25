"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import type { Json } from "@/lib/db/database.types";
import { MEAL_TYPE_LABELS, isMealType, type MealType } from "@/lib/meal/meal-types";
import { shiftDay } from "@/lib/meal/day";
import { listDayForCopy } from "@/lib/meal/shortcuts-queries";
import { parseCopyForm, parseFavoriteForm, planCopy } from "@/lib/meal/shortcuts";
import { dayToTimestamp, todayIn } from "@/lib/weight/entries";

export type CopyState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

const COPY_ERROR: CopyState = {
  status: "error",
  message: "No se pudo copiar. Inténtalo de nuevo.",
};

/** Marca o desmarca un alimento como favorito (RF-22). La RLS limita a los propios. */
export async function toggleFavorite(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = parseFavoriteForm(formData);
  if (!parsed) return;

  const supabase = await createClient();
  if (parsed.favorite) {
    await supabase
      .from("favorite_food")
      .upsert(
        { user_id: user.id, food_id: parsed.foodId },
        { onConflict: "user_id,food_id", ignoreDuplicates: true },
      );
  } else {
    await supabase
      .from("favorite_food")
      .delete()
      .eq("user_id", user.id)
      .eq("food_id", parsed.foodId);
  }
  revalidatePath("/alimentos");
  revalidatePath(`/alimentos/${parsed.foodId}`);
}

/**
 * Copia las comidas del día anterior al día de destino (RF-22): el día completo o
 * solo una comida. Copia la instantánea de nutrientes de cada ítem tal cual. Es
 * idempotente por comida: si el destino ya tiene registros de esa comida, no se
 * copia (así repetir la acción o pulsarla dos veces no duplica nada).
 */
export async function copyMeals(
  _prev: CopyState,
  formData: FormData,
): Promise<CopyState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return COPY_ERROR;
  if (!profile) redirect("/onboarding");

  const parsed = parseCopyForm(formData, todayIn(profile.timezone));
  if (!parsed.success) return { status: "error", message: parsed.message };
  const { date, mealType } = parsed.data;

  let source;
  let target;
  try {
    [source, target] = await Promise.all([
      listDayForCopy(user.id, shiftDay(date, -1)),
      listDayForCopy(user.id, date),
    ]);
  } catch {
    return COPY_ERROR;
  }

  const occupied = new Set<MealType>(
    target
      .filter((entry) => entry.meal_item.length > 0 && isMealType(entry.meal_type))
      .map((entry) => entry.meal_type as MealType),
  );
  const plan = planCopy(source, occupied, mealType);

  if (plan.meals.length === 0) {
    return {
      status: "error",
      message:
        plan.skipped.length > 0
          ? "Ese día ya tiene registros en esa comida; no se copió para no duplicar."
          : "No hay comidas para copiar del día anterior.",
    };
  }

  const created: string[] = [];
  let copied = 0;
  for (const meal of plan.meals) {
    const { data: entry, error } = await supabase
      .from("meal_entry")
      .insert({
        user_id: user.id,
        meal_type: meal.mealType,
        eaten_at: dayToTimestamp(date),
      })
      .select("id")
      .single();
    if (error) return await rollback(supabase, created);
    created.push(entry.id);

    const { error: itemsError } = await supabase.from("meal_item").insert(
      meal.items.map((item) => ({
        ...item,
        nutrients: item.nutrients as Json,
        meal_entry_id: entry.id,
      })),
    );
    if (itemsError) return await rollback(supabase, created);
    copied += meal.items.length;
  }

  revalidatePath("/comidas");
  const skipped =
    plan.skipped.length > 0
      ? ` Se omitió ${plan.skipped.map((t) => MEAL_TYPE_LABELS[t].toLowerCase()).join(", ")} (ya tenía registros).`
      : "";
  return {
    status: "done",
    message: `Se copiaron ${copied} ${copied === 1 ? "alimento" : "alimentos"}.${skipped}`,
  };
}

/** Deshace las comidas creadas (sus ítems caen por cascada) si algo falla a medias. */
async function rollback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryIds: string[],
): Promise<CopyState> {
  if (entryIds.length > 0) await supabase.from("meal_entry").delete().in("id", entryIds);
  return COPY_ERROR;
}
