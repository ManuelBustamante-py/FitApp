"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { dayRange, dayToTimestamp, todayIn } from "@/lib/weight/entries";
import { parseWeightForm, type WeightFieldErrors } from "@/lib/weight/schema";

export type WeightFormState =
  | { status: "idle" }
  | { status: "saved"; updated: boolean }
  | { status: "error"; message?: string; errors?: WeightFieldErrors };

const SAVE_ERROR: WeightFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

/**
 * Registra el peso de un día. La tabla no tiene unicidad por día, así que si ya hay
 * un registro ese día se actualiza (un peso por día) en lugar de duplicarlo.
 */
export async function saveWeight(
  _prev: WeightFormState,
  formData: FormData,
): Promise<WeightFormState> {
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

  const parsed = parseWeightForm(formData, todayIn(profile.timezone));
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const { weightKg, date } = parsed.data;

  const { from, to } = dayRange(date);
  const { data: existing, error: existingError } = await supabase
    .from("body_measurement")
    .select("id")
    .eq("user_id", user.id)
    .gte("measured_at", from)
    .lt("measured_at", to)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return SAVE_ERROR;

  const { error } = existing
    ? await supabase
        .from("body_measurement")
        .update({ weight_kg: weightKg, measured_at: dayToTimestamp(date) })
        .eq("id", existing.id)
    : await supabase.from("body_measurement").insert({
        user_id: user.id,
        weight_kg: weightKg,
        measured_at: dayToTimestamp(date),
      });
  if (error) return SAVE_ERROR;

  revalidatePath("/peso");
  return { status: "saved", updated: Boolean(existing) };
}

/** Elimina un registro de peso del usuario con sesión. */
export async function deleteWeight(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;

  const supabase = await createClient();
  await supabase.from("body_measurement").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/peso");
}
