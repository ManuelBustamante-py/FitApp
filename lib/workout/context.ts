import {
  ageOn,
  bmr,
  KEYTEL_HR_MAX,
  KEYTEL_HR_MIN,
  mifflinStJeor,
  type BmrFormula,
  type KcalMethod,
  type Sex,
} from "@/lib/calc";

export const KCAL_METHOD_LABELS: Record<KcalMethod, string> = {
  hr: "Pulso",
  met: "MET",
  machine: "Máquina",
  manual: "Manual",
};

export const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Fuerza",
  flexibility: "Flexibilidad",
  sport: "Deportes",
  daily: "Actividades cotidianas",
  other: "Otras",
};

/** `true` si el pulso promedio está fuera del rango en que Keytel es confiable. */
export function isHrOutOfRange(hrAvg: number | null | undefined): boolean {
  return hrAvg != null && (hrAvg < KEYTEL_HR_MIN || hrAvg > KEYTEL_HR_MAX);
}

/** Datos personales que usan las estimaciones de una sesión. */
export interface ExerciseContext {
  sex: Sex;
  ageYears: number;
  weightKg: number;
  /** TMB con la fórmula del perfil (o Mifflin si a esa fórmula le faltan datos). */
  bmr: number;
}

export interface ExerciseProfile {
  sex: string;
  birth_date: string;
  height_cm: number;
  bmr_formula: string;
  bmr_measured_kcal: number | null;
}

/**
 * Sexo, edad, último peso y TMB del usuario en `day`. Devuelve null si falta el
 * peso: sin él no hay estimación por pulso, por MET ni TMB.
 */
export function exerciseContext(
  profile: ExerciseProfile,
  weightKg: number | null,
  bodyFatPct: number | null,
  day: string,
): ExerciseContext | null {
  if (weightKg === null) return null;
  const sex = profile.sex as Sex;
  const ageYears = ageOn(profile.birth_date, day);
  const input = {
    sex,
    weightKg,
    heightCm: profile.height_cm,
    ageYears,
    bodyFatPct,
    measuredKcal: profile.bmr_measured_kcal,
  };
  // Como en /actividad: si la fórmula elegida no se puede calcular, Mifflin.
  let value: number | undefined;
  try {
    value = bmr(profile.bmr_formula as BmrFormula, input);
  } catch {
    value = undefined;
  }
  if (value === undefined || !Number.isFinite(value) || value <= 0)
    value = mifflinStJeor(input);
  return { sex, ageYears, weightKg, bmr: value };
}
