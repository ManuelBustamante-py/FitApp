import { describe, expect, it } from "vitest";
import {
  dailyBalance,
  dailyTargetKcal,
  isIntakeBelowMinimum,
  prudentWeeklyLossKg,
  weeklyWeightChangeKg,
} from "./balance";

describe("dailyBalance", () => {
  it("ingesta − TDEE; negativo = déficit", () => {
    expect(dailyBalance(1958, 2458)).toBe(-500);
    expect(dailyBalance(2600, 2458)).toBe(142);
  });

  it("rechaza datos inválidos", () => {
    expect(() => dailyBalance(-1, 2000)).toThrow(RangeError);
    expect(() => dailyBalance(1800, 0)).toThrow(RangeError);
  });
});

describe("weeklyWeightChangeKg", () => {
  it("déficit de 500 kcal/día ≈ −0,45 kg/semana", () => {
    expect(weeklyWeightChangeKg(-500)).toBeCloseTo(-0.4545, 4);
  });

  it("rechaza valores no finitos", () => {
    expect(() => weeklyWeightChangeKg(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("prudentWeeklyLossKg", () => {
  it("0,5–1 % del peso por semana", () => {
    const range = prudentWeeklyLossKg(101);
    expect(range.minKg).toBeCloseTo(0.505, 6);
    expect(range.maxKg).toBeCloseTo(1.01, 6);
  });

  it("rechaza peso no positivo", () => {
    expect(() => prudentWeeklyLossKg(0)).toThrow(RangeError);
  });
});

describe("isIntakeBelowMinimum", () => {
  it("avisa bajo ~1.500 kcal (hombres) y ~1.200 (mujeres)", () => {
    expect(isIntakeBelowMinimum(1499, "male")).toBe(true);
    expect(isIntakeBelowMinimum(1500, "male")).toBe(false);
    expect(isIntakeBelowMinimum(1199, "female")).toBe(true);
    expect(isIntakeBelowMinimum(1300, "female")).toBe(false);
  });

  it("rechaza ingesta negativa", () => {
    expect(() => isIntakeBelowMinimum(-1, "male")).toThrow(RangeError);
  });
});

describe("dailyTargetKcal", () => {
  const base = {
    tdeeKcal: 2458,
    currentWeightKg: 101,
    targetWeightKg: 80,
    sex: "male" as const,
  };

  it("bajar 0,5 kg/semana → TDEE − 550", () => {
    const t = dailyTargetKcal({ ...base, weeklyRateKg: -0.5 });
    expect(t.mode).toBe("lose");
    expect(t.adjustmentKcal).toBeCloseTo(-550, 6);
    expect(t.kcal).toBeCloseTo(1908, 6);
    expect(t.limitedToMinimum).toBe(false);
  });

  it("subir 0,25 kg/semana → TDEE + 275", () => {
    const t = dailyTargetKcal({
      ...base,
      currentWeightKg: 60,
      targetWeightKg: 65,
      weeklyRateKg: 0.25,
    });
    expect(t).toMatchObject({ mode: "gain", limitedToMinimum: false });
    expect(t.kcal).toBeCloseTo(2733, 6);
  });

  it("mantiene si el peso ya está en la meta (dentro de la tolerancia)", () => {
    const t = dailyTargetKcal({ ...base, currentWeightKg: 80.05, weeklyRateKg: -0.5 });
    expect(t).toEqual({
      kcal: 2458,
      adjustmentKcal: 0,
      mode: "maintain",
      limitedToMinimum: false,
    });
  });

  it("mantiene si el ritmo no va hacia la meta o es 0", () => {
    expect(
      dailyTargetKcal({ ...base, currentWeightKg: 75, weeklyRateKg: -0.5 }).mode,
    ).toBe("maintain");
    expect(dailyTargetKcal({ ...base, weeklyRateKg: 0 }).mode).toBe("maintain");
    expect(dailyTargetKcal({ ...base, weeklyRateKg: 0.5 }).mode).toBe("maintain");
  });

  it("al bajar no deja la meta bajo el mínimo prudente del sexo", () => {
    const t = dailyTargetKcal({
      tdeeKcal: 1700,
      currentWeightKg: 70,
      targetWeightKg: 60,
      sex: "female",
      weeklyRateKg: -1,
    });
    expect(t).toMatchObject({ kcal: 1200, mode: "lose", limitedToMinimum: true });
    expect(t.adjustmentKcal).toBeCloseTo(-1100, 6);
  });

  it("si el TDEE es menor que el mínimo, la meta no supera el TDEE", () => {
    const t = dailyTargetKcal({
      tdeeKcal: 1400,
      currentWeightKg: 70,
      targetWeightKg: 60,
      sex: "male",
      weeklyRateKg: -0.5,
    });
    expect(t).toMatchObject({ kcal: 1400, limitedToMinimum: true });
  });

  it("rechaza datos inválidos", () => {
    expect(() => dailyTargetKcal({ ...base, tdeeKcal: 0, weeklyRateKg: -0.5 })).toThrow(
      RangeError,
    );
    expect(() =>
      dailyTargetKcal({ ...base, currentWeightKg: 0, weeklyRateKg: -0.5 }),
    ).toThrow(RangeError);
    expect(() =>
      dailyTargetKcal({ ...base, targetWeightKg: -1, weeklyRateKg: -0.5 }),
    ).toThrow(RangeError);
    expect(() => dailyTargetKcal({ ...base, weeklyRateKg: Number.NaN })).toThrow(
      RangeError,
    );
  });
});
