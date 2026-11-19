import { assertNonNegative, assertPositive, MINUTES_PER_DAY, type Sex } from "./common";

/** Método con que se eligió el gasto (mismo CHECK que `workout_session.kcal_method`). */
export type KcalMethod = "hr" | "met" | "machine" | "manual";

/** Rango de FC en que Keytel es confiable (ejercicio aeróbico). */
export const KEYTEL_HR_MIN = 90;
export const KEYTEL_HR_MAX = 150;

export interface KeytelInput {
  sex: Sex;
  hrAvg: number;
  weightKg: number;
  ageYears: number;
  durationMin: number;
}

export interface KeytelResult {
  kcal: number;
  kcalPerMin: number;
  /** `false` si la FC está fuera de 90–150 lpm ("baja confianza"). */
  reliable: boolean;
}

/** Gasto bruto por frecuencia cardíaca (Keytel et al., 2005). */
export function keytelKcal({
  sex,
  hrAvg,
  weightKg,
  ageYears,
  durationMin,
}: KeytelInput): KeytelResult {
  assertPositive(hrAvg, "hrAvg");
  assertPositive(weightKg, "weightKg");
  assertPositive(ageYears, "ageYears");
  assertNonNegative(durationMin, "durationMin");
  const kj =
    sex === "male"
      ? -55.0969 + 0.6309 * hrAvg + 0.1988 * weightKg + 0.2017 * ageYears
      : -20.4022 + 0.4472 * hrAvg - 0.1263 * weightKg + 0.074 * ageYears;
  const kcalPerMin = Math.max(0, kj / 4.184);
  return {
    kcal: kcalPerMin * durationMin,
    kcalPerMin,
    reliable: hrAvg >= KEYTEL_HR_MIN && hrAvg <= KEYTEL_HR_MAX,
  };
}

/** Gasto bruto por MET: kcal = MET × peso_kg × horas. */
export function metKcal(met: number, weightKg: number, durationMin: number): number {
  assertPositive(met, "met");
  assertPositive(weightKg, "weightKg");
  assertNonNegative(durationMin, "durationMin");
  return met * weightKg * (durationMin / 60);
}

/** Gasto neto = bruto − TMB/1440 × minutos (nunca negativo). */
export function netExerciseKcal(
  grossKcal: number,
  bmr: number,
  durationMin: number,
): number {
  assertNonNegative(grossKcal, "grossKcal");
  assertPositive(bmr, "bmr");
  assertNonNegative(durationMin, "durationMin");
  return Math.max(0, grossKcal - (bmr / MINUTES_PER_DAY) * durationMin);
}

export interface ExerciseEstimates {
  hr?: number | null;
  met?: number | null;
  machine?: number | null;
  manual?: number | null;
}

/**
 * Elige la estimación con la prioridad de docs/03 §4: pulso → MET → máquina,
 * y el valor manual solo si no hay ninguna otra. `null` si no hay ninguna.
 */
export function selectExerciseKcal(
  estimates: ExerciseEstimates,
): { kcal: number; method: KcalMethod } | null {
  const order: readonly KcalMethod[] = ["hr", "met", "machine", "manual"];
  for (const method of order) {
    const kcal = estimates[method];
    if (kcal != null && Number.isFinite(kcal) && kcal >= 0) return { kcal, method };
  }
  return null;
}

export interface ExerciseEstimateInput {
  sex: Sex;
  ageYears: number;
  weightKg: number;
  /** TMB (kcal/día) para descontar el reposo del tiempo de la sesión. */
  bmr: number;
  /** MET de la actividad (catálogo). */
  met: number;
  durationMin: number;
  hrAvg?: number | null;
  machineKcal?: number | null;
}

export interface ExerciseEstimate {
  /** Estimación por pulso (Keytel); null si no se ingresó el pulso promedio. */
  hr: KeytelResult | null;
  /** Estimación por MET. */
  met: number;
  /** Valor de la consola, como referencia; null si no se ingresó. */
  machine: number | null;
  /** Gasto bruto elegido (pulso → MET → máquina) y su método. */
  selected: { kcal: number; method: KcalMethod };
  /** Gasto neto: bruto elegido − TMB/1440 × minutos (docs/03 §4.4). */
  netKcal: number;
}

/**
 * Las tres cifras de una sesión, la elegida y el gasto neto (docs/03 §4,
 * RF-11 y RF-12). El pulso fuera de 90–150 lpm se usa igual, pero queda
 * marcado como baja confianza en `hr.reliable`.
 */
export function estimateExercise(input: ExerciseEstimateInput): ExerciseEstimate {
  const { sex, ageYears, weightKg, bmr, met, durationMin, hrAvg, machineKcal } = input;
  assertPositive(durationMin, "durationMin");
  const hr =
    hrAvg == null ? null : keytelKcal({ sex, hrAvg, weightKg, ageYears, durationMin });
  const metEstimate = metKcal(met, weightKg, durationMin);
  if (machineKcal != null) assertNonNegative(machineKcal, "machineKcal");
  const machine = machineKcal ?? null;
  // Con MET siempre presente, la selección nunca es null.
  const selected = selectExerciseKcal({
    hr: hr?.kcal,
    met: metEstimate,
    machine,
  }) as { kcal: number; method: KcalMethod };
  return {
    hr,
    met: metEstimate,
    machine,
    selected,
    netKcal: netExerciseKcal(selected.kcal, bmr, durationMin),
  };
}
