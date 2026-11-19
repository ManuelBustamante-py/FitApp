import { describe, expect, it } from "vitest";
import { mifflinStJeor } from "./bmr";
import { keytelKcal, metKcal, netExerciseKcal, selectExerciseKcal } from "./exercise";

const referenceBmr = mifflinStJeor({
  sex: "male",
  weightKg: 101,
  heightCm: 175,
  ageYears: 23,
});

describe("keytelKcal", () => {
  it("caso de referencia: 17 min a 137 lpm ≈ 228 kcal (13,4 kcal/min)", () => {
    const result = keytelKcal({
      sex: "male",
      hrAvg: 137,
      weightKg: 101,
      ageYears: 23,
      durationMin: 17,
    });
    expect(result.kcalPerMin).toBeCloseTo(13.397, 3);
    expect(result.kcal).toBeCloseTo(227.75, 1);
    expect(result.reliable).toBe(true);
  });

  it("fórmula de mujer", () => {
    const result = keytelKcal({
      sex: "female",
      hrAvg: 140,
      weightKg: 70,
      ageYears: 30,
      durationMin: 10,
    });
    const expected = (-20.4022 + 0.4472 * 140 - 0.1263 * 70 + 0.074 * 30) / 4.184;
    expect(result.kcalPerMin).toBeCloseTo(expected, 6);
    expect(result.kcal).toBeCloseTo(expected * 10, 6);
  });

  it("marca baja confianza fuera de 90–150 lpm", () => {
    const base = { sex: "male", weightKg: 101, ageYears: 23, durationMin: 10 } as const;
    expect(keytelKcal({ ...base, hrAvg: 89 }).reliable).toBe(false);
    expect(keytelKcal({ ...base, hrAvg: 90 }).reliable).toBe(true);
    expect(keytelKcal({ ...base, hrAvg: 150 }).reliable).toBe(true);
    expect(keytelKcal({ ...base, hrAvg: 165 }).reliable).toBe(false);
  });

  it("no devuelve gasto negativo con pulsos muy bajos", () => {
    const result = keytelKcal({
      sex: "female",
      hrAvg: 30,
      weightKg: 120,
      ageYears: 20,
      durationMin: 10,
    });
    expect(result.kcal).toBe(0);
  });

  it("rechaza datos inválidos", () => {
    const base = {
      sex: "male",
      hrAvg: 137,
      weightKg: 101,
      ageYears: 23,
      durationMin: 17,
    } as const;
    expect(() => keytelKcal({ ...base, hrAvg: 0 })).toThrow(RangeError);
    expect(() => keytelKcal({ ...base, durationMin: -1 })).toThrow(RangeError);
  });
});

describe("metKcal", () => {
  it("caso de referencia: MET 7,0 × 101 kg × 17 min ≈ 200 kcal", () => {
    expect(metKcal(7, 101, 17)).toBeCloseTo(200.32, 2);
  });

  it("rechaza datos inválidos", () => {
    expect(() => metKcal(0, 101, 17)).toThrow(RangeError);
    expect(() => metKcal(7, 101, -1)).toThrow(RangeError);
  });
});

describe("netExerciseKcal", () => {
  it("caso de referencia: 228 − 1.994/1.440 × 17 ≈ 204 kcal netas", () => {
    const gross = keytelKcal({
      sex: "male",
      hrAvg: 137,
      weightKg: 101,
      ageYears: 23,
      durationMin: 17,
    }).kcal;
    expect(netExerciseKcal(gross, referenceBmr, 17)).toBeCloseTo(204.21, 1);
  });

  it("nunca es negativo", () => {
    expect(netExerciseKcal(10, 2000, 60)).toBe(0);
  });

  it("rechaza datos inválidos", () => {
    expect(() => netExerciseKcal(-1, 2000, 10)).toThrow(RangeError);
    expect(() => netExerciseKcal(100, 0, 10)).toThrow(RangeError);
  });
});

describe("selectExerciseKcal", () => {
  it("prioridad pulso → MET → máquina → manual", () => {
    expect(selectExerciseKcal({ hr: 228, met: 200, machine: 77, manual: 150 })).toEqual({
      kcal: 228,
      method: "hr",
    });
    expect(selectExerciseKcal({ hr: null, met: 200, machine: 77 })).toEqual({
      kcal: 200,
      method: "met",
    });
    expect(selectExerciseKcal({ machine: 77, manual: 150 })).toEqual({
      kcal: 77,
      method: "machine",
    });
    expect(selectExerciseKcal({ manual: 150 })).toEqual({ kcal: 150, method: "manual" });
  });

  it("ignora valores inválidos y devuelve null si no hay ninguno", () => {
    expect(selectExerciseKcal({ hr: Number.NaN, met: -3, machine: 77 })).toEqual({
      kcal: 77,
      method: "machine",
    });
    expect(selectExerciseKcal({})).toBeNull();
  });
});
