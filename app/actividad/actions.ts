"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLatestBodyFat } from "@/lib/activity/queries";
import {
  parseBmrForm,
  parseDayAdjustmentForm,
  parseScheduleForm,
  parseStepsSettingsForm,
  type ActivityChoice,
} from "@/lib/activity/schema";
import { createClient, getCurrentUser } from "@/lib/db/server";

export type ActivityFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: Record<string, string | undefined> };

const SAVE_ERROR: ActivityFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

function choiceColumns(choice: ActivityChoice) {
  return choice.mode === "steps"
    ? { mode: "steps", level: null, custom_factor: null, steps: choice.steps }
    : {
        mode: "level",
        level: choice.level,
        custom_factor: choice.customFactor,
        steps: null,
      };
}

/** Fórmula de TMB (y valor medido) del perfil. */
export async function saveBmrFormula(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = parseBmrForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const { formula, measuredKcal } = parsed.data;

  if (formula === "katch_mcardle" || formula === "cunningham") {
    let bodyFat: number | null;
    try {
      bodyFat = await getLatestBodyFat(user.id);
    } catch {
      return SAVE_ERROR;
    }
    if (bodyFat === null)
      return {
        status: "error",
        errors: { bmrFormula: "Esta fórmula necesita tu % de grasa corporal." },
      };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .update({
      bmr_formula: formula,
      // Se conserva el valor medido aunque se elija otra fórmula, para poder volver.
      ...(measuredKcal !== null ? { bmr_measured_kcal: measuredKcal } : {}),
    })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) return SAVE_ERROR;
  if (!data || data.length === 0) redirect("/onboarding");

  revalidatePath("/actividad");
  return { status: "saved" };
}

/** Umbral de pasos sedentarios y largo de paso. */
export async function saveStepsSettings(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = parseStepsSettingsForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .update({
      sedentary_steps_threshold: parsed.data.thresholdSteps,
      stride_m: parsed.data.strideM,
    })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) return SAVE_ERROR;
  if (!data || data.length === 0) redirect("/onboarding");

  revalidatePath("/actividad");
  return { status: "saved" };
}

/** Semana tipo: reemplaza las 7 reglas. */
export async function saveSchedule(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = parseScheduleForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase.from("activity_schedule").upsert(
    parsed.data.map(({ weekday, choice }) => {
      const c = choiceColumns(choice);
      return {
        user_id: user.id,
        weekday,
        mode: c.mode,
        level: c.level,
        custom_factor: c.custom_factor,
        steps_target: c.steps,
      };
    }),
    { onConflict: "user_id,weekday" },
  );
  if (error) return SAVE_ERROR;

  revalidatePath("/actividad");
  return { status: "saved" };
}

/** Ajuste de una fecha (nivel o pasos reales); reemplaza a la semana tipo ese día. */
export async function saveDayAdjustment(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = parseDayAdjustmentForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };

  const c = choiceColumns(parsed.data.choice);
  const supabase = await createClient();
  const { error } = await supabase.from("daily_activity").upsert(
    {
      user_id: user.id,
      day: parsed.data.day,
      mode: c.mode,
      level: c.level,
      custom_factor: c.custom_factor,
      steps_actual: c.steps,
    },
    { onConflict: "user_id,day" },
  );
  if (error) return SAVE_ERROR;

  revalidatePath("/actividad");
  return { status: "saved" };
}

/** Quita el ajuste de una fecha (vuelve a regir la semana tipo). */
export async function deleteDayAdjustment(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const day = formData.get("day");
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const supabase = await createClient();
  await supabase.from("daily_activity").delete().eq("user_id", user.id).eq("day", day);
  revalidatePath("/actividad");
}
