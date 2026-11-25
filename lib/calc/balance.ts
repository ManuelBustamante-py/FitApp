import { assertNonNegative, assertPositive, KCAL_PER_KG, type Sex } from "./common";

/** balance = ingesta − TDEE_día. Negativo = déficit (docs/03 §6). */
export function dailyBalance(intakeKcal: number, tdeeDayKcal: number): number {
  assertNonNegative(intakeKcal, "intakeKcal");
  assertPositive(tdeeDayKcal, "tdeeDayKcal");
  return intakeKcal - tdeeDayKcal;
}

/** Ingesta mínima bajo la cual se sugiere consultar a un profesional (docs/03 §7). */
export const MIN_SAFE_INTAKE_KCAL: Readonly<Record<Sex, number>> = {
  male: 1500,
  female: 1200,
};

/** `true` si la ingesta del día está bajo el mínimo prudente para el sexo. */
export function isIntakeBelowMinimum(intakeKcal: number, sex: Sex): boolean {
  assertNonNegative(intakeKcal, "intakeKcal");
  return intakeKcal < MIN_SAFE_INTAKE_KCAL[sex];
}

/**
 * Cambio de peso semanal (kg) con la regla de 7.700 kcal/kg. Negativo = baja.
 * Un balance de −500 kcal/día da ≈ −0,45 kg/semana.
 */
export function weeklyWeightChangeKg(dailyBalanceKcal: number): number {
  if (!Number.isFinite(dailyBalanceKcal))
    throw new RangeError("dailyBalanceKcal inválido");
  return (dailyBalanceKcal * 7) / KCAL_PER_KG;
}

/** Ritmo prudente de pérdida: 0,5–1 % del peso corporal por semana (kg/semana). */
export function prudentWeeklyLossKg(weightKg: number): { minKg: number; maxKg: number } {
  assertPositive(weightKg, "weightKg");
  return { minKg: weightKg * 0.005, maxKg: weightKg * 0.01 };
}

/** Diferencia con la meta bajo la cual se considera que el peso ya llegó (kg). */
export const GOAL_REACHED_TOLERANCE_KG = 0.1;

export type TargetMode = "lose" | "gain" | "maintain";

export interface DailyTargetInput {
  /** TDEE del día (kcal). */
  tdeeKcal: number;
  /** Ritmo de la meta con signo: negativo = bajar, positivo = subir (`goal.weekly_rate_kg`). */
  weeklyRateKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  sex: Sex;
}

export interface DailyTarget {
  /** Ingesta meta del día. */
  kcal: number;
  /** Ajuste sobre el TDEE (ritmo × 7.700 / 7); 0 al mantener. */
  adjustmentKcal: number;
  mode: TargetMode;
  /** `true` si la meta se subió al mínimo prudente de ingesta (docs/03 §7). */
  limitedToMinimum: boolean;
}

/**
 * Meta diaria de kcal (RF-03, docs/03 §7): TDEE_día + ritmo_semanal × 7.700 / 7.
 * Mantiene (meta = TDEE) si el peso ya llegó a la meta o el ritmo no va hacia
 * ella. Al bajar, la meta nunca queda bajo el mínimo prudente del sexo.
 */
export function dailyTargetKcal({
  tdeeKcal,
  weeklyRateKg,
  currentWeightKg,
  targetWeightKg,
  sex,
}: DailyTargetInput): DailyTarget {
  assertPositive(tdeeKcal, "tdeeKcal");
  assertPositive(currentWeightKg, "currentWeightKg");
  assertPositive(targetWeightKg, "targetWeightKg");
  if (!Number.isFinite(weeklyRateKg)) throw new RangeError("weeklyRateKg inválido");

  const gap = targetWeightKg - currentWeightKg;
  const towardGoal =
    Math.abs(gap) > GOAL_REACHED_TOLERANCE_KG &&
    weeklyRateKg !== 0 &&
    Math.sign(weeklyRateKg) === Math.sign(gap);
  if (!towardGoal)
    return {
      kcal: tdeeKcal,
      adjustmentKcal: 0,
      mode: "maintain",
      limitedToMinimum: false,
    };

  const adjustmentKcal = (weeklyRateKg * KCAL_PER_KG) / 7;
  const raw = tdeeKcal + adjustmentKcal;
  if (weeklyRateKg > 0)
    return { kcal: raw, adjustmentKcal, mode: "gain", limitedToMinimum: false };
  const floor = Math.min(tdeeKcal, MIN_SAFE_INTAKE_KCAL[sex]);
  return {
    kcal: Math.max(raw, floor),
    adjustmentKcal,
    mode: "lose",
    limitedToMinimum: raw < floor,
  };
}
