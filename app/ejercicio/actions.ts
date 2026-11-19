"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { estimateExercise, type KcalMethod } from "@/lib/calc";
import { createClient, getCurrentUser } from "@/lib/db/server";
import { dayToTimestamp, todayIn } from "@/lib/weight/entries";
import { exerciseContext } from "@/lib/workout/context";
import { getBodyData } from "@/lib/workout/queries";
import { parseWorkoutForm, type WorkoutFieldErrors } from "@/lib/workout/schema";

export interface WorkoutSummary {
  selectedKcal: number;
  method: KcalMethod;
  netKcal: number;
  machineKcal: number | null;
}

export type WorkoutFormState =
  | { status: "idle" }
  | { status: "saved"; summary: WorkoutSummary }
  | { status: "error"; message?: string; errors?: WorkoutFieldErrors };

const SAVE_ERROR: WorkoutFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

/** Máximo de las columnas numeric(6,1) de kcal. */
const KCAL_COLUMN_MAX = 99999.9;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Registra una sesión de ejercicio (RF-10). Las estimaciones se recalculan en el
 * servidor con el perfil, el último peso y el MET del catálogo (RF-11, RF-12);
 * nunca se confía en cifras calculadas por el cliente.
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
    .select("timezone, sex, birth_date, height_cm, bmr_formula, bmr_measured_kcal")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return SAVE_ERROR;
  if (!profile) redirect("/onboarding");

  const parsed = parseWorkoutForm(formData, todayIn(profile.timezone));
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const values = parsed.data;

  const { data: activity, error: activityError } = await supabase
    .from("activity_type")
    .select("met")
    .eq("id", values.activityTypeId)
    .maybeSingle();
  if (activityError) return SAVE_ERROR;
  if (!activity)
    return { status: "error", errors: { activityTypeId: "Elige una actividad." } };

  let body: Awaited<ReturnType<typeof getBodyData>>;
  try {
    body = await getBodyData(user.id);
  } catch {
    return SAVE_ERROR;
  }
  const context = exerciseContext(profile, body.weightKg, body.bodyFatPct, values.date);
  if (!context)
    return {
      status: "error",
      message: "Registra tu peso antes de anotar una sesión: lo usan las estimaciones.",
    };

  const estimate = estimateExercise({
    ...context,
    met: activity.met,
    durationMin: values.durationMin,
    hrAvg: values.hrAvg,
    machineKcal: values.machineKcal,
  });
  const kcalHr = estimate.hr === null ? null : round1(estimate.hr.kcal);
  const kcalMet = round1(estimate.met);
  const kcalSelected = round1(estimate.selected.kcal);
  if (Math.max(kcalHr ?? 0, kcalMet, kcalSelected) > KCAL_COLUMN_MAX)
    return {
      status: "error",
      errors: { durationMin: "La duración es demasiado larga para esta actividad." },
    };

  const { error } = await supabase.from("workout_session").insert({
    user_id: user.id,
    activity_type_id: values.activityTypeId,
    started_at: dayToTimestamp(values.date),
    duration_min: values.durationMin,
    distance_km: values.distanceKm,
    machine_kcal: values.machineKcal,
    hr_avg: values.hrAvg,
    hr_min: values.hrMin,
    hr_max: values.hrMax,
    rpe: values.rpe,
    notes: values.notes,
    kcal_hr: kcalHr,
    kcal_met: kcalMet,
    kcal_selected: kcalSelected,
    kcal_method: estimate.selected.method,
    kcal_net: round1(estimate.netKcal),
  });
  if (error) return SAVE_ERROR;

  revalidatePath("/ejercicio");
  return {
    status: "saved",
    summary: {
      selectedKcal: estimate.selected.kcal,
      method: estimate.selected.method,
      netKcal: estimate.netKcal,
      machineKcal: values.machineKcal,
    },
  };
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
