import "server-only";

import { estimateExercise, type KcalMethod } from "@/lib/calc";
import { createClient } from "@/lib/db/server";
import { dayToTimestamp } from "@/lib/weight/entries";

import { exerciseContext, type ExerciseProfile } from "./context";
import { getBodyData } from "./queries";
import type { WorkoutFieldErrors, WorkoutFormValues } from "./schema";

export interface WorkoutSummary {
  selectedKcal: number;
  method: KcalMethod;
  netKcal: number;
  machineKcal: number | null;
}

export type RegisterResult =
  | { status: "saved"; summary: WorkoutSummary }
  | { status: "error"; message?: string; errors?: WorkoutFieldErrors };

export const SAVE_ERROR = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
} as const;

/** Máximo de las columnas numeric(6,1) de kcal. */
const KCAL_COLUMN_MAX = 99999.9;

const round1 = (value: number) => Math.round(value * 10) / 10;

export const PROFILE_COLUMNS =
  "timezone, sex, birth_date, height_cm, bmr_formula, bmr_measured_kcal";

/**
 * Estima (MET/pulso/máquina) e inserta una sesión de ejercicio del usuario. Es el
 * camino único del formulario y de las plantillas: las cifras se recalculan en el
 * servidor con el perfil, el último peso y el MET del catálogo (RF-11, RF-12).
 */
export async function registerWorkout(
  userId: string,
  profile: ExerciseProfile,
  values: WorkoutFormValues,
): Promise<RegisterResult> {
  const supabase = await createClient();

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
    body = await getBodyData(userId);
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
    user_id: userId,
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
