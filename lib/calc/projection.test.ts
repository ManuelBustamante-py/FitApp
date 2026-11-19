import { describe, expect, it } from "vitest";
import { mifflinStJeor } from "./bmr";
import { daysToGoal, projectWeight, trendWeights } from "./projection";

describe("trendWeights", () => {
  it("el primer registro fija la tendencia y luego suaviza con α = 0,1", () => {
    const points = trendWeights([
      { day: "2026-11-01", weightKg: 101 },
      { day: "2026-11-02", weightKg: 100 },
    ]);
    expect(points[0]?.trendKg).toBe(101);
    expect(points[1]?.trendKg).toBeCloseTo(100.9, 6);
  });

  it("ordena por fecha y pondera los huecos como varios días", () => {
    const points = trendWeights([
      { day: "2026-11-04", weightKg: 100 },
      { day: "2026-11-01", weightKg: 101 },
    ]);
    expect(points.map((p) => p.day)).toEqual(["2026-11-01", "2026-11-04"]);
    // Hueco de 3 días: 1 − 0,9³ = 0,271.
    expect(points[1]?.trendKg).toBeCloseTo(101 - 0.271, 6);
  });

  it("varios registros del mismo día cuentan como un paso cada uno", () => {
    const points = trendWeights(
      [
        { day: "2026-11-01", weightKg: 100 },
        { day: "2026-11-01", weightKg: 102 },
      ],
      0.5,
    );
    expect(points[1]?.trendKg).toBe(101);
  });

  it("lista vacía → sin puntos", () => {
    expect(trendWeights([])).toEqual([]);
  });

  it("rechaza α, fechas o pesos inválidos", () => {
    expect(() => trendWeights([], 0)).toThrow(RangeError);
    expect(() => trendWeights([], 1.5)).toThrow(RangeError);
    expect(() => trendWeights([{ day: "ayer", weightKg: 100 }])).toThrow(RangeError);
    expect(() => trendWeights([{ day: "2026-11-01", weightKg: 0 }])).toThrow(RangeError);
  });
});

describe("projectWeight", () => {
  const tdeeForWeight = (weightKg: number) =>
    mifflinStJeor({ sex: "male", weightKg, heightCm: 175, ageYears: 23 }) * 1.2;

  it("TDEE fijo: lineal y adaptativa coinciden (−500 kcal/día × 77 días = −5 kg)", () => {
    const result = projectWeight({
      weightKg: 101,
      intakeKcal: 1500,
      tdeeForWeight: () => 2000,
      days: 77,
    });
    expect(result.linearKg).toBeCloseTo(96, 6);
    expect(result.adaptiveKg).toBeCloseTo(96, 6);
  });

  it("con TDEE que baja con el peso, la adaptativa baja menos que la lineal", () => {
    const result = projectWeight({
      weightKg: 101,
      intakeKcal: 1900,
      tdeeForWeight,
      days: 90,
    });
    const initialDeficit = 1900 - tdeeForWeight(101);
    expect(result.linearKg).toBeCloseTo(101 + (initialDeficit * 90) / 7700, 6);
    expect(result.adaptiveKg).toBeLessThan(101);
    expect(result.adaptiveKg).toBeGreaterThan(result.linearKg);
  });

  it("0 días → el mismo peso", () => {
    expect(
      projectWeight({ weightKg: 101, intakeKcal: 1900, tdeeForWeight, days: 0 }),
    ).toEqual({
      linearKg: 101,
      adaptiveKg: 101,
    });
  });

  it("rechaza datos inválidos", () => {
    expect(() =>
      projectWeight({ weightKg: 101, intakeKcal: 1900, tdeeForWeight, days: 1.5 }),
    ).toThrow(RangeError);
    expect(() =>
      projectWeight({ weightKg: 101, intakeKcal: 1900, tdeeForWeight, days: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      projectWeight({ weightKg: 0, intakeKcal: 1900, tdeeForWeight, days: 1 }),
    ).toThrow(RangeError);
  });
});

describe("daysToGoal", () => {
  it("de 101 a 96 kg con −500 kcal/día = 77 días", () => {
    expect(daysToGoal(101, 96, -500)).toBeCloseTo(77, 6);
  });

  it("subir de peso con superávit", () => {
    expect(daysToGoal(60, 61, 250)).toBeCloseTo(30.8, 6);
  });

  it("ya en la meta → 0; balance en contra o nulo → null", () => {
    expect(daysToGoal(80, 80, -500)).toBe(0);
    expect(daysToGoal(101, 96, 200)).toBeNull();
    expect(daysToGoal(101, 96, 0)).toBeNull();
  });

  it("rechaza pesos no positivos", () => {
    expect(() => daysToGoal(0, 80, -500)).toThrow(RangeError);
  });
});
