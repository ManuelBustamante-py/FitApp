import { assertNonNegative, assertPositive } from "./common";
import {
  activityFactor,
  DEFAULT_SEDENTARY_STEPS_THRESHOLD,
  stepsKcal as stepsKcalFor,
  tdeeDay,
  type ActivityLevel,
} from "./activity";

/** Actividad cotidiana de un día: un nivel con su factor, o una cantidad de pasos. */
export type DayActivity =
  | { mode: "level"; level: ActivityLevel; customFactor?: number | null }
  | { mode: "steps"; steps: number };

/** Actividad que se asume cuando no hay semana tipo ni ajuste (ADR-0005: sedentario). */
export const DEFAULT_DAY_ACTIVITY: DayActivity = { mode: "level", level: "sedentary" };

/** Factor base del modo por pasos (docs/03 §3.2). */
const STEPS_BASE_LEVEL: ActivityLevel = "sedentary";

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha `YYYY-MM-DD`. */
export function isoWeekday(day: string): number {
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha inválida: ${day}`);
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

/**
 * Actividad de una fecha: el ajuste de esa fecha reemplaza a la semana tipo
 * (docs/03 §3.3); sin ninguno de los dos, sedentario.
 */
export function resolveDayActivity(
  day: string,
  schedule: Readonly<Record<number, DayActivity | undefined>>,
  overrides: Readonly<Record<string, DayActivity | undefined>> = {},
): DayActivity {
  return overrides[day] ?? schedule[isoWeekday(day)] ?? DEFAULT_DAY_ACTIVITY;
}

export interface DayTdeeInput {
  bmr: number;
  activity: DayActivity;
  weightKg: number;
  /** Largo de paso en metros; solo se usa en el modo por pasos. */
  strideM: number;
  thresholdSteps?: number;
  exerciseNetKcal?: number;
}

export interface DayTdeeBreakdown {
  bmr: number;
  factor: number;
  stepsKcal: number;
  exerciseNetKcal: number;
  /** TMB × factor + kcal de pasos + ejercicio neto. */
  total: number;
}

/** TDEE de un día con su desglose (TMB × factor + pasos + ejercicio). */
export function dayTdee({
  bmr,
  activity,
  weightKg,
  strideM,
  thresholdSteps = DEFAULT_SEDENTARY_STEPS_THRESHOLD,
  exerciseNetKcal = 0,
}: DayTdeeInput): DayTdeeBreakdown {
  assertPositive(bmr, "bmr");
  assertNonNegative(exerciseNetKcal, "exerciseNetKcal");
  let factor: number;
  let stepsKcal = 0;
  if (activity.mode === "steps") {
    factor = activityFactor(STEPS_BASE_LEVEL);
    stepsKcal = stepsKcalFor({
      steps: activity.steps,
      weightKg,
      strideM,
      thresholdSteps,
    });
  } else {
    factor = activityFactor(activity.level, activity.customFactor);
  }
  return {
    bmr,
    factor,
    stepsKcal,
    exerciseNetKcal,
    total: tdeeDay({ bmr, factor, stepsKcal, exerciseNetKcal }),
  };
}
