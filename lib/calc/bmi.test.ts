import { describe, expect, it } from "vitest";
import { bmi, bmiCategory, healthyWeightRange, weightForBmi } from "./bmi";

describe("bmi", () => {
  it("caso de referencia: 101 kg y 1,75 m → 33,0", () => {
    expect(bmi(101, 175)).toBeCloseTo(32.98, 2);
    expect(bmi(101, 175).toFixed(1)).toBe("33.0");
  });

  it("rechaza valores no positivos", () => {
    expect(() => bmi(0, 175)).toThrow(RangeError);
    expect(() => bmi(80, -1)).toThrow(RangeError);
    expect(() => bmi(Number.NaN, 175)).toThrow(RangeError);
  });
});

describe("bmiCategory", () => {
  it.each([
    [18.4, "underweight"],
    [18.5, "normal"],
    [24.9, "normal"],
    [25, "overweight"],
    [29.99, "overweight"],
    [30, "obesity_1"],
    [33.0, "obesity_1"],
    [35, "obesity_2"],
    [39.9, "obesity_2"],
    [40, "obesity_3"],
  ] as const)("IMC %s → %s", (value, category) => {
    expect(bmiCategory(value)).toBe(category);
  });

  it("rechaza IMC no positivo", () => {
    expect(() => bmiCategory(0)).toThrow(RangeError);
  });
});

describe("weightForBmi y healthyWeightRange", () => {
  it("peso para IMC 24,9 con 1,75 m ≈ 76,3 kg", () => {
    expect(weightForBmi(24.9, 175)).toBeCloseTo(76.26, 2);
  });

  it("rango normal 56,7 – 76,3 kg con 1,75 m", () => {
    const range = healthyWeightRange(175);
    expect(range.minKg).toBeCloseTo(56.66, 2);
    expect(range.maxKg).toBeCloseTo(76.26, 2);
  });

  it("rechaza datos inválidos", () => {
    expect(() => weightForBmi(0, 175)).toThrow(RangeError);
    expect(() => weightForBmi(24.9, 0)).toThrow(RangeError);
  });
});
