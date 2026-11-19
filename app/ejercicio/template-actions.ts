"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { todayIn } from "@/lib/weight/entries";
import {
  PROFILE_COLUMNS,
  registerWorkout,
  SAVE_ERROR,
  type WorkoutSummary,
} from "@/lib/workout/register";
import { parseTemplateForm, type TemplateFieldErrors } from "@/lib/workout/template";

export type TemplateFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: TemplateFieldErrors };

export type RegisterFromTemplateState =
  | { status: "idle" }
  | { status: "saved"; summary: WorkoutSummary }
  | { status: "error"; message: string };

/** Crea (sin `id`) o edita (con `id`) una plantilla del usuario (RF-13). */
export async function saveTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const { name, activityTypeId, durationMin } = parsed.data;

  const supabase = await createClient();
  const id = formData.get("id");
  if (typeof id === "string" && id !== "") {
    const { data, error } = await supabase
      .from("workout_template")
      .update({ name, activity_type_id: activityTypeId, duration_min: durationMin })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    if (error || !data || data.length === 0)
      return { status: "error", message: "No se pudo guardar la plantilla." };
  } else {
    const { error } = await supabase.from("workout_template").insert({
      user_id: user.id,
      name,
      activity_type_id: activityTypeId,
      duration_min: durationMin,
    });
    if (error) return { status: "error", message: "No se pudo guardar la plantilla." };
  }

  revalidatePath("/ejercicio");
  return { status: "saved" };
}

/** Elimina una plantilla del usuario con sesión. */
export async function deleteTemplate(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;

  const supabase = await createClient();
  await supabase.from("workout_template").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/ejercicio");
}

/**
 * Un toque: registra hoy una sesión con la actividad y la duración de la
 * plantilla, estimada por MET (sin pulso) por el mismo camino del formulario.
 */
export async function registerFromTemplate(
  _prev: RegisterFromTemplateState,
  formData: FormData,
): Promise<RegisterFromTemplateState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id");
  if (typeof id !== "string" || id === "")
    return { status: "error", message: "Plantilla no válida." };

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return { status: "error", message: SAVE_ERROR.message };
  if (!profile) redirect("/onboarding");

  const { data: template, error } = await supabase
    .from("workout_template")
    .select("activity_type_id, duration_min")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { status: "error", message: SAVE_ERROR.message };
  if (!template) return { status: "error", message: "La plantilla ya no existe." };

  const result = await registerWorkout(user.id, profile, {
    activityTypeId: template.activity_type_id,
    date: todayIn(profile.timezone),
    durationMin: template.duration_min,
    hrAvg: null,
    hrMin: null,
    hrMax: null,
    machineKcal: null,
    distanceKm: null,
    rpe: null,
    notes: null,
  });
  if (result.status === "error")
    return {
      status: "error",
      message:
        result.message ??
        result.errors?.durationMin ??
        result.errors?.activityTypeId ??
        SAVE_ERROR.message,
    };

  revalidatePath("/ejercicio");
  return { status: "saved", summary: result.summary };
}
