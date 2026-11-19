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
