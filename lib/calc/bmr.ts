import { assertPositive, type Sex } from "./common";

/** Fórmulas de TMB (mismo CHECK que `profile.bmr_formula`). */
export type BmrFormula =
  "mifflin" | "harris_benedict" | "katch_mcardle" | "cunningham" | "measured";

export const BMR_FORMULAS: readonly BmrFormula[] = [
  "mifflin",
  "harris_benedict",
  "katch_mcardle",
  "cunningham",
  "measured",
];

export const DEFAULT_BMR_FORMULA: BmrFormula = "mifflin";

/** Datos de la persona. Los opcionales solo los piden algunas fórmulas. */
export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  /** % de grasa corporal (Katch-McArdle y Cunningham). */
  bodyFatPct?: number | null;
  /** kcal/día medidas por calorimetría (fórmula `measured`). */
  measuredKcal?: number | null;
}

/** Edad cumplida en años a una fecha (por defecto, hoy). Fechas `YYYY-MM-DD` o `Date`. */
export function ageOn(
  birthDate: string | Date,
  onDate: string | Date = new Date(),
): number {
  const birth = toUtcDate(birthDate);
  const on = toUtcDate(onDate);
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (age < 0)
    throw new RangeError("La fecha de nacimiento es posterior a la fecha de cálculo");
  return age;
}

function toUtcDate(value: string | Date): Date {
  const date =
    typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  if (Number.isNaN(date.getTime()))
    throw new RangeError(`Fecha inválida: ${String(value)}`);
  return date;
}

/** Mifflin-St Jeor (1990). */
export function mifflinStJeor({ sex, weightKg, heightCm, ageYears }: BmrInput): number {
  assertBody(weightKg, heightCm, ageYears);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

/** Harris-Benedict revisada (Roza & Shizgal, 1984). */
export function harrisBenedict({ sex, weightKg, heightCm, ageYears }: BmrInput): number {
  assertBody(weightKg, heightCm, ageYears);
  return sex === "male"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
}

/** Masa libre de grasa (kg) = peso × (1 − %grasa/100). */
export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  assertPositive(weightKg, "weightKg");
  if (!Number.isFinite(bodyFatPct) || bodyFatPct < 0 || bodyFatPct >= 100) {
    throw new RangeError(`bodyFatPct debe estar entre 0 y 100 (recibido: ${bodyFatPct})`);
  }
  return weightKg * (1 - bodyFatPct / 100);
}

/** Katch-McArdle: 370 + 21,6 · MLG. */
export function katchMcArdle({ weightKg, bodyFatPct }: BmrInput): number {
  return 370 + 21.6 * leanMassKg(weightKg, requireBodyFat(bodyFatPct));
}

/** Cunningham: 500 + 22 · MLG. */
export function cunningham({ weightKg, bodyFatPct }: BmrInput): number {
  return 500 + 22 * leanMassKg(weightKg, requireBodyFat(bodyFatPct));
}

/** TMB con la fórmula elegida. Lanza `RangeError` si faltan los datos que esa fórmula pide. */
export function bmr(formula: BmrFormula, input: BmrInput): number {
  switch (formula) {
    case "mifflin":
      return mifflinStJeor(input);
    case "harris_benedict":
      return harrisBenedict(input);
    case "katch_mcardle":
      return katchMcArdle(input);
    case "cunningham":
      return cunningham(input);
    case "measured":
      if (input.measuredKcal == null) throw new RangeError("Falta measuredKcal");
      assertPositive(input.measuredKcal, "measuredKcal");
      return input.measuredKcal;
  }
}

/**
 * TMB con todas las fórmulas que los datos permiten, para compararlas en el
 * perfil (docs/03 §2). Omite las que no se pueden calcular.
 */
export function bmrComparison(input: BmrInput): Partial<Record<BmrFormula, number>> {
  const result: Partial<Record<BmrFormula, number>> = {};
  for (const formula of BMR_FORMULAS) {
    if (!canCompute(formula, input)) continue;
    result[formula] = bmr(formula, input);
  }
  return result;
}

function canCompute(formula: BmrFormula, input: BmrInput): boolean {
  if (formula === "measured") return input.measuredKcal != null;
  if (formula === "katch_mcardle" || formula === "cunningham")
    return input.bodyFatPct != null;
  return true;
}

function requireBodyFat(bodyFatPct: number | null | undefined): number {
  if (bodyFatPct == null) throw new RangeError("Falta bodyFatPct");
  return bodyFatPct;
}

function assertBody(weightKg: number, heightCm: number, ageYears: number): void {
  assertPositive(weightKg, "weightKg");
  assertPositive(heightCm, "heightCm");
  assertPositive(ageYears, "ageYears");
}
