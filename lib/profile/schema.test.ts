import { describe, expect, it } from "vitest";

import { dominantLevel, shouldWriteSchedule } from "./level";
import { parseProfileForm } from "./schema";
import {
  resolveTargetWeightKg,
  signedWeeklyRateKg,
  toFormDefaults,
  toGoalRow,
  toProfileRow,
} from "./transform";

const valid = {
  sex: "female",
  birthDate: "1990-05-10",
  heightCm: "165",
  activityLevel: "light",
  timezone: "America/Santiago",
  goalType: "weight",
  targetWeightKg: "60,5",
  targetBmi: "",
  goalDirection: "lose",
  weeklyRateKg: "0,5",
};

function parse(overrides: Record<string, unknown> = {}) {
  return parseProfileForm({ ...valid, ...overrides });
}

function errorsOf(overrides: Record<string, unknown>) {
  const result = parse(overrides);
  if (result.success) throw new Error("se esperaba un error");
  return result.errors;
}

describe("parseProfileForm", () => {
  it("acepta datos válidos y convierte la coma decimal", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.heightCm).toBe(165);
    expect(result.data.targetWeightKg).toBe(60.5);
    expect(result.data.weeklyRateKg).toBe(0.5);
  });

  it("lee un FormData", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, v);
    expect(parseProfileForm(fd).success).toBe(true);
  });

  it("exige los campos obligatorios", () => {
    const errors = errorsOf({ sex: "", birthDate: "", heightCm: "", activityLevel: "" });
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(["sex", "birthDate", "heightCm", "activityLevel"]),
    );
  });

  it("limita el ritmo semanal entre 0,25 y 1 kg", () => {
    expect(errorsOf({ weeklyRateKg: "0,2" }).weeklyRateKg).toMatch(/0,25/);
    expect(errorsOf({ weeklyRateKg: "1,1" }).weeklyRateKg).toMatch(/1 kg/);
    expect(parse({ weeklyRateKg: "0.25" }).success).toBe(true);
    expect(parse({ weeklyRateKg: "1" }).success).toBe(true);
    expect(errorsOf({ weeklyRateKg: "abc" }).weeklyRateKg).toBeDefined();
  });

  it("valida la fecha de nacimiento (formato, futuro y edad)", () => {
    expect(errorsOf({ birthDate: "31/12/1990" }).birthDate).toBeDefined();
    expect(errorsOf({ birthDate: "1990-02-30" }).birthDate).toBeDefined();
    expect(errorsOf({ birthDate: "2999-01-01" }).birthDate).toMatch(/futura/);
    expect(errorsOf({ birthDate: "2020-01-01" }).birthDate).toMatch(/edad/);
  });

  it("valida estatura y zona horaria", () => {
    expect(errorsOf({ heightCm: "90" }).heightCm).toBeDefined();
    expect(errorsOf({ heightCm: "250" }).heightCm).toBeDefined();
    expect(errorsOf({ timezone: "Marte/Olimpo" }).timezone).toBeDefined();
  });

  it("meta por peso exige peso en rango", () => {
    expect(errorsOf({ targetWeightKg: "" }).targetWeightKg).toBeDefined();
    expect(errorsOf({ targetWeightKg: "20" }).targetWeightKg).toBeDefined();
    expect(errorsOf({ targetWeightKg: "400" }).targetWeightKg).toBeDefined();
  });

  it("meta por IMC exige IMC en rango", () => {
    const bmiGoal = { goalType: "bmi", targetWeightKg: "" };
    expect(errorsOf({ ...bmiGoal, targetBmi: "" }).targetBmi).toBeDefined();
    expect(errorsOf({ ...bmiGoal, targetBmi: "10" }).targetBmi).toBeDefined();
    expect(errorsOf({ ...bmiGoal, targetBmi: "45" }).targetBmi).toBeDefined();
    expect(parse({ ...bmiGoal, targetBmi: "22" }).success).toBe(true);
  });
});

describe("transformaciones", () => {
  it("convierte IMC objetivo a peso con la estatura", () => {
    const result = parse({ goalType: "bmi", targetWeightKg: "", targetBmi: "22" });
    if (!result.success) throw new Error("inválido");
    // 22 × 1,65² = 59,895
    expect(resolveTargetWeightKg(result.data)).toBe(59.9);
    expect(toGoalRow(result.data)).toEqual({
      target_weight_kg: 59.9,
      target_bmi: 22,
      weekly_rate_kg: -0.5,
    });
  });

  it("usa el peso ingresado y deja target_bmi nulo", () => {
    const result = parse();
    if (!result.success) throw new Error("inválido");
    expect(toGoalRow(result.data)).toEqual({
      target_weight_kg: 60.5,
      target_bmi: null,
      weekly_rate_kg: -0.5,
    });
  });

  it("el ritmo lleva signo según la dirección", () => {
    const lose = parse();
    const gain = parse({ goalDirection: "gain", weeklyRateKg: "0.75" });
    if (!lose.success || !gain.success) throw new Error("inválido");
    expect(signedWeeklyRateKg(lose.data)).toBe(-0.5);
    expect(signedWeeklyRateKg(gain.data)).toBe(0.75);
  });

  it("arma la fila de perfil", () => {
    const result = parse();
    if (!result.success) throw new Error("inválido");
    expect(toProfileRow(result.data)).toEqual({
      sex: "female",
      birth_date: "1990-05-10",
      height_cm: 165,
      timezone: "America/Santiago",
    });
  });

  it("reconstruye los valores del formulario desde lo guardado", () => {
    const base = {
      sex: "male",
      birth_date: "1985-01-01",
      height_cm: 180,
      timezone: "UTC",
      level: "moderate",
    };
    expect(
      toFormDefaults({
        ...base,
        goal: { target_weight_kg: 72, target_bmi: 22.2, weekly_rate_kg: 0.25 },
      }),
    ).toMatchObject({
      goalType: "bmi",
      targetBmi: "22.2",
      goalDirection: "gain",
      weeklyRateKg: "0.25",
      heightCm: "180",
    });
    expect(
      toFormDefaults({
        ...base,
        goal: { target_weight_kg: 72, target_bmi: null, weekly_rate_kg: -0.5 },
      }),
    ).toMatchObject({ goalType: "weight", goalDirection: "lose", weeklyRateKg: "0.5" });
    expect(toFormDefaults({ ...base, goal: null })).toMatchObject({
      goalType: "weight",
      targetWeightKg: "",
      weeklyRateKg: "0.5",
    });
  });
});

describe("semana tipo", () => {
  const week = (levels: string[]) => levels.map((level) => ({ mode: "level", level }));

  it("detecta el nivel dominante", () => {
    expect(dominantLevel([])).toBeNull();
    expect(dominantLevel(week(["light", "light", "active"]))).toBe("light");
    expect(dominantLevel([{ mode: "steps", level: null }])).toBeNull();
  });

  it("no pisa una semana ya configurada con el mismo nivel dominante", () => {
    const configured = week([
      "light",
      "light",
      "light",
      "light",
      "light",
      "active",
      "active",
    ]);
    expect(shouldWriteSchedule(configured, "light")).toBe(false);
    expect(shouldWriteSchedule(configured, "moderate")).toBe(true);
    expect(shouldWriteSchedule([], "light")).toBe(true);
    expect(shouldWriteSchedule(week(["light", "light"]), "light")).toBe(true);
  });
});
