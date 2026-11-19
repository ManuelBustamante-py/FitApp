import { assertPositive } from "./common";

/** Categorías de IMC en adultos según la OMS (docs/03 §1). */
export type BmiCategory =
  "underweight" | "normal" | "overweight" | "obesity_1" | "obesity_2" | "obesity_3";

/** Límite superior del rango normal usado para el peso objetivo. */
export const BMI_NORMAL_MIN = 18.5;
export const BMI_NORMAL_MAX = 24.9;

/** IMC = peso_kg / estatura_m². */
export function bmi(weightKg: number, heightCm: number): number {
  assertPositive(weightKg, "weightKg");
  assertPositive(heightCm, "heightCm");
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Categoría OMS. Los cortes son 18,5 / 25 / 30 / 35 / 40; la tabla del
 * documento muestra los rangos con un decimal (24,9 = hasta antes de 25).
 */
export function bmiCategory(value: number): BmiCategory {
  assertPositive(value, "bmi");
  if (value < 18.5) return "underweight";
  if (value < 25) return "normal";
  if (value < 30) return "overweight";
  if (value < 35) return "obesity_1";
  if (value < 40) return "obesity_2";
  return "obesity_3";
}

/** Peso (kg) que corresponde a un IMC dado para una estatura. */
export function weightForBmi(targetBmi: number, heightCm: number): number {
  assertPositive(targetBmi, "targetBmi");
  assertPositive(heightCm, "heightCm");
  const heightM = heightCm / 100;
  return targetBmi * heightM * heightM;
}

/** Rango de peso normal (IMC 18,5 – 24,9) para una estatura. */
export function healthyWeightRange(heightCm: number): { minKg: number; maxKg: number } {
  return {
    minKg: weightForBmi(BMI_NORMAL_MIN, heightCm),
    maxKg: weightForBmi(BMI_NORMAL_MAX, heightCm),
  };
}
