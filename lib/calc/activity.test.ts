import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  activityFactor,
  averageTdee,
  stepsKcal,
  strideLengthM,
  tdeeDay,
} from "./activity";
import { mifflinStJeor } from "./bmr";

const referenceBmr = mifflinStJeor({
  sex: "male",
  weightKg: 101,
  heightCm: 175,
  ageYears: 23,
});

describe("activityFactor", () => {
  it("devuelve los factores de la tabla 3.1", () => {
    expect(activityFactor("bmr_only")).toBe(1);
    expect(activityFactor("sedentary")).toBe(1.2);
    expect(activityFactor("light")).toBe(1.375);
    expect(activityFactor("moderate")).toBe(1.55);
    expect(activityFactor("active")).toBe(1.725);
    expect(activityFactor("very_active")).toBe(1.9);
    expect(Object.keys(ACTIVITY_FACTORS)).toHaveLength(6);
  });

  it("custom usa el factor del usuario y lo exige", () => {
    expect(activityFactor("custom", 1.45)).toBe(1.45);
    expect(() => activityFactor("custom")).toThrow(/customFactor/);
    expect(() => activityFactor("custom", 0)).toThrow(RangeError);
  });
});

describe("modo por pasos", () => {
  it("largo de paso: 1,75 m × 0,415 (hombre) y × 0,413 (mujer)", () => {
    expect(strideLengthM(175, "male")).toBeCloseTo(0.72625, 6);
    expect(strideLengthM(160, "female")).toBeCloseTo(0.6608, 6);
  });

  it("caso de referencia: 5.000 pasos → ≈ 92 kcal extra", () => {
    const kcal = stepsKcal({
      steps: 5000,
      weightKg: 101,
      strideM: strideLengthM(175, "male"),
    });
    expect(kcal).toBeCloseTo(91.69, 2);
  });

  it("bajo el umbral no suma kcal; el umbral es configurable", () => {
    expect(stepsKcal({ steps: 2000, weightKg: 101, strideM: 0.7 })).toBe(0);
    expect(
      stepsKcal({ steps: 4000, weightKg: 100, strideM: 1, thresholdSteps: 3000 }),
    ).toBe(50);
  });

  it("rechaza datos inválidos", () => {
    expect(() => stepsKcal({ steps: -1, weightKg: 101, strideM: 0.7 })).toThrow(
      RangeError,
    );
    expect(() => stepsKcal({ steps: 5000, weightKg: 101, strideM: 0 })).toThrow(
      RangeError,
    );
    expect(() => strideLengthM(0, "male")).toThrow(RangeError);
  });
});

describe("tdeeDay", () => {
  const steps = stepsKcal({
    steps: 5000,
    weightKg: 101,
    strideM: strideLengthM(175, "male"),
  });
  const weekday = tdeeDay({ bmr: referenceBmr, factor: 1.2, stepsKcal: steps });
  const weekend = tdeeDay({ bmr: referenceBmr, factor: activityFactor("sedentary") });

  it("lun–vie con 5.000 pasos ≈ 2.484 kcal", () => {
    expect(weekday).toBeCloseTo(2484.19, 1);
  });

  it("sáb–dom sedentario ≈ 2.393 kcal", () => {
    expect(weekend).toBeCloseTo(2392.5, 6);
  });

  it("promedio semanal ≈ 2.458 kcal/día", () => {
    const week = [weekday, weekday, weekday, weekday, weekday, weekend, weekend];
    expect(averageTdee(week)).toBeCloseTo(2457.99, 1);
  });

  it("suma el ejercicio neto aparte del factor", () => {
    expect(tdeeDay({ bmr: 2000, factor: 1.2, exerciseNetKcal: 204 })).toBe(2604);
  });

  it("rechaza datos inválidos", () => {
    expect(() => tdeeDay({ bmr: 0, factor: 1.2 })).toThrow(RangeError);
    expect(() => tdeeDay({ bmr: 2000, factor: 1.2, exerciseNetKcal: -1 })).toThrow(
      RangeError,
    );
    expect(() => averageTdee([])).toThrow(RangeError);
  });
});
