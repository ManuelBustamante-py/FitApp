import { describe, expect, it } from "vitest";

import { exerciseContext, isHrOutOfRange } from "./context";

const profile = {
  sex: "male",
  birth_date: "2003-05-01",
  height_cm: 175,
  bmr_formula: "mifflin",
  bmr_measured_kcal: null,
};

describe("exerciseContext", () => {
  it("caso de referencia: 101 kg, 23 años → TMB Mifflin ≈ 1.994", () => {
    const ctx = exerciseContext(profile, 101, null, "2026-11-19");
    expect(ctx).toMatchObject({ sex: "male", ageYears: 23, weightKg: 101 });
    expect(ctx?.bmr).toBeCloseTo(1993.75, 2);
  });

  it("sin peso devuelve null", () => {
    expect(exerciseContext(profile, null, null, "2026-11-19")).toBeNull();
  });

  it("usa la fórmula del perfil y vuelve a Mifflin si le faltan datos", () => {
    const measured = { ...profile, bmr_formula: "measured", bmr_measured_kcal: 2100 };
    expect(exerciseContext(measured, 101, null, "2026-11-19")?.bmr).toBe(2100);
    const katch = { ...profile, bmr_formula: "katch_mcardle" };
    expect(exerciseContext(katch, 101, null, "2026-11-19")?.bmr).toBeCloseTo(1993.75, 2);
    expect(exerciseContext(katch, 100, 30, "2026-11-19")?.bmr).toBeCloseTo(1882, 2);
  });
});

describe("isHrOutOfRange", () => {
  it("marca el pulso fuera de 90–150 lpm", () => {
    expect(isHrOutOfRange(null)).toBe(false);
    expect(isHrOutOfRange(90)).toBe(false);
    expect(isHrOutOfRange(150)).toBe(false);
    expect(isHrOutOfRange(89)).toBe(true);
    expect(isHrOutOfRange(151)).toBe(true);
  });
});
