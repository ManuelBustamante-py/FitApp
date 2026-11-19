"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { todayIn } from "@/lib/weight/entries";
import { PROFILE_COLUMNS, registerWorkout, SAVE_ERROR } from "@/lib/workout/register";
import type { WorkoutSummary } from "@/lib/workout/register";
import { parseWorkoutForm, type WorkoutFieldErrors } from "@/lib/workout/schema";
import { defaultTemplateName, parseTemplateForm } from "@/lib/workout/template";

export type WorkoutFormState =
  | { status: "idle" }
  | {
      status: "saved";
      summary: WorkoutSummary;
      /** null si no se pidió guardar plantilla; false si falló. */
      templateSaved: boolean | null;
    }
  | { status: "error"; message?: string; errors?: WorkoutFieldErrors };

/**
 * Registra una sesión de ejercicio (RF-10). Las estimaciones se recalculan en el
 * servidor (ver `registerWorkout`); con «Guardar como plantilla» marcado también
 * crea la plantilla (RF-13).
 */
export async function saveWorkout(
  _prev: WorkoutFormState,
  formData: FormData,
): Promise<WorkoutFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return SAVE_ERROR;
  if (!profile) redirect("/onboarding");

  const parsed = parseWorkoutForm(formData, todayIn(profile.timezone));
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const values = parsed.data;

  const result = await registerWorkout(user.id, profile, values);
  if (result.status === "error") return result;

  let templateSaved: boolean | null = null;
  if (formData.get("saveTemplate") === "on") {
    templateSaved = false;
    const { data: activity } = await supabase
      .from("activity_type")
      .select("name_es")
      .eq("id", values.activityTypeId)
      .maybeSingle();
    const template = parseTemplateForm(
      {
        name: formData.get("templateName"),
        activityTypeId: values.activityTypeId,
        durationMin: values.durationMin,
      },
      ({ durationMin }) =>
        defaultTemplateName(activity?.name_es ?? "Sesión", durationMin),
    );
    if (template.success) {
      const { error } = await supabase.from("workout_template").insert({
        user_id: user.id,
        name: template.data.name,
        activity_type_id: template.data.activityTypeId,
        duration_min: template.data.durationMin,
      });
      templateSaved = !error;
    }
  }

  revalidatePath("/ejercicio");
  return { status: "saved", summary: result.summary, templateSaved };
}

/** Elimina una sesión del usuario con sesión. */
export async function deleteWorkout(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;

  const supabase = await createClient();
  await supabase.from("workout_session").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/ejercicio");
}
