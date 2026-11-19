import { describe, expect, it } from "vitest";
import {
  dailyBalance,
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
