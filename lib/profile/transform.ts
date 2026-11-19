import { weightForBmi } from "@/lib/calc";

import type { ProfileFormValues } from "./schema";

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Peso objetivo en kg: el ingresado, o el que corresponde al IMC objetivo y la estatura. */
export function resolveTargetWeightKg(values: ProfileFormValues): number {
  if (values.goalType === "bmi") {
    return round1(weightForBmi(values.targetBmi as number, values.heightCm));
  }
  return round1(values.targetWeightKg as number);
}

/** `weekly_rate_kg` con signo: negativo = bajar, positivo = subir. */
export function signedWeeklyRateKg(values: ProfileFormValues): number {
  const magnitude = Math.round(values.weeklyRateKg * 100) / 100;
  return values.goalDirection === "lose" ? -magnitude : magnitude;
}

export function toProfileRow(values: ProfileFormValues) {
  return {
    sex: values.sex,
    birth_date: values.birthDate,
    height_cm: values.heightCm,
    timezone: values.timezone,
  };
}

export function toGoalRow(values: ProfileFormValues) {
  return {
    target_weight_kg: resolveTargetWeightKg(values),
    target_bmi: values.goalType === "bmi" ? round1(values.targetBmi as number) : null,
    weekly_rate_kg: signedWeeklyRateKg(values),
  };
}

export interface StoredProfile {
  sex: string;
  birth_date: string;
  height_cm: number;
  timezone: string;
  level: string;
  goal: {
    target_weight_kg: number;
    target_bmi: number | null;
    weekly_rate_kg: number;
  } | null;
}

/** Valores iniciales del formulario a partir de lo guardado. */
export function toFormDefaults({ goal, ...stored }: StoredProfile) {
  return {
    sex: stored.sex,
    birthDate: stored.birth_date,
    heightCm: String(stored.height_cm),
    timezone: stored.timezone,
    activityLevel: stored.level,
    goalType: goal?.target_bmi != null ? "bmi" : "weight",
    targetWeightKg: goal ? String(goal.target_weight_kg) : "",
    targetBmi: goal?.target_bmi != null ? String(goal.target_bmi) : "",
    goalDirection: goal && goal.weekly_rate_kg > 0 ? "gain" : "lose",
    weeklyRateKg: goal ? String(Math.abs(goal.weekly_rate_kg)) : "0.5",
  };
}
