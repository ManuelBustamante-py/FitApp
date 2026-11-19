import { assertNonNegative, assertPositive, type Sex } from "./common";

/** Niveles de actividad cotidiana (mismo CHECK que `activity_schedule.level`). */
export type ActivityLevel =
  "bmr_only" | "sedentary" | "light" | "moderate" | "active" | "very_active" | "custom";

/** Factores de docs/03 §3.1 (sin `custom`, que define el usuario). */
export const ACTIVITY_FACTORS: Readonly<
  Record<Exclude<ActivityLevel, "custom">, number>
> = {
  bmr_only: 1.0,
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Umbral sedentario por defecto del modo por pasos. */
export const DEFAULT_SEDENTARY_STEPS_THRESHOLD = 2500;

/** Costo neto de caminar, kcal por kg y por km. */
export const WALKING_KCAL_PER_KG_KM = 0.5;

const STRIDE_RATIO: Readonly<Record<Sex, number>> = { male: 0.415, female: 0.413 };

/** Factor del nivel. `custom` exige `customFactor`. */
export function activityFactor(
  level: ActivityLevel,
  customFactor?: number | null,
): number {
  if (level !== "custom") return ACTIVITY_FACTORS[level];
  if (customFactor == null)
    throw new RangeError("Falta customFactor para el nivel custom");
  assertPositive(customFactor, "customFactor");
  return customFactor;
}

/** Largo de paso estimado (m) = estatura_m × 0,415 (hombre) | 0,413 (mujer). */
export function strideLengthM(heightCm: number, sex: Sex): number {
  assertPositive(heightCm, "heightCm");
  return (heightCm / 100) * STRIDE_RATIO[sex];
}

export interface StepsKcalInput {
  steps: number;
  weightKg: number;
  /** Largo de paso en metros (medido o `strideLengthM`). */
  strideM: number;
  /** Pasos que ya cubre el factor sedentario. */
  thresholdSteps?: number;
}

/** kcal de los pasos que superan el umbral sedentario (docs/03 §3.2). */
export function stepsKcal({
  steps,
  weightKg,
  strideM,
  thresholdSteps = DEFAULT_SEDENTARY_STEPS_THRESHOLD,
}: StepsKcalInput): number {
  assertNonNegative(steps, "steps");
  assertNonNegative(thresholdSteps, "thresholdSteps");
  assertPositive(weightKg, "weightKg");
  assertPositive(strideM, "strideM");
  const extraKm = (Math.max(0, steps - thresholdSteps) * strideM) / 1000;
  return extraKm * weightKg * WALKING_KCAL_PER_KG_KM;
}

export interface TdeeDayInput {
  bmr: number;
  /** Factor del día: el del nivel, o 1,2 (sedentario) en modo por pasos. */
  factor: number;
  /** kcal de pasos extra del día (modo por pasos). */
  stepsKcal?: number;
  /** Suma del ejercicio neto del día; nunca va dentro del factor. */
  exerciseNetKcal?: number;
}

/** TDEE_día = TMB × factor + kcal_pasos_extra + Σ ejercicio_neto (docs/03 §3). */
export function tdeeDay({
  bmr,
  factor,
  stepsKcal = 0,
  exerciseNetKcal = 0,
}: TdeeDayInput): number {
  assertPositive(bmr, "bmr");
  assertPositive(factor, "factor");
  assertNonNegative(stepsKcal, "stepsKcal");
  assertNonNegative(exerciseNetKcal, "exerciseNetKcal");
  return bmr * factor + stepsKcal + exerciseNetKcal;
}

/** Promedio simple de una lista de TDEE diarios (p. ej., la semana tipo). */
export function averageTdee(days: readonly number[]): number {
  if (days.length === 0) throw new RangeError("Se necesita al menos un día");
  return days.reduce((sum, value) => sum + value, 0) / days.length;
}
