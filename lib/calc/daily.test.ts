import { describe, expect, it } from "vitest";

import {
  DEFAULT_DAY_ACTIVITY,
  dayTdee,
  isoWeekday,
  mifflinStJeor,
  resolveDayActivity,
  strideLengthM,
  averageTdee,
  type DayActivity,
} from "./index";

// Caso de referencia de docs/03 §3.4: 101 kg, 175 cm, 23 años, hombre.
const bmr = mifflinStJeor({ sex: "male", weightKg: 101, heightCm: 175, ageYears: 23 });
const strideM = strideLengthM(175, "male");
const base = { bmr, weightKg: 101, strideM };

describe("isoWeekday", () => {
  it("lunes = 1 y domingo = 7", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(isoWeekday("2026-11-21")).toBe(6);
  });
  it("rechaza fechas inválidas", () => {
    expect(() => isoWeekday("no-fecha")).toThrow(RangeError);
  });
});

describe("dayTdee (caso de referencia)", () => {
  const weekday = dayTdee({ ...base, activity: { mode: "steps", steps: 5000 } });
  const weekend = dayTdee({ ...base, activity: { mode: "level", level: "sedentary" } });

  it("TMB Mifflin ≈ 1.994 kcal", () => {
    expect(bmr).toBeCloseTo(1993.75, 2);
  });
  it("lun–vie con 5.000 pasos ≈ 2.484 kcal", () => {
    expect(weekday.total).toBeCloseTo(2484.2, 0);
    expect(weekday.factor).toBe(1.2);
    expect(weekday.stepsKcal).toBeGreaterThan(90);
  });
  it("sáb–dom sedentario ≈ 2.393 kcal", () => {
    expect(weekend.total).toBeCloseTo(2392.5, 1);
    expect(weekend.stepsKcal).toBe(0);
  });
  it("promedio semanal ≈ 2.458 kcal/día", () => {
    const week = [1, 2, 3, 4, 5, 6, 7].map((d) => (d <= 5 ? weekday : weekend).total);
    expect(averageTdee(week)).toBeCloseTo(2458, 0);
  });
});

describe("dayTdee otros casos", () => {
  it("respeta el umbral configurable", () => {
    const low = dayTdee({
      ...base,
      activity: { mode: "steps", steps: 5000 },
      thresholdSteps: 5000,
    });
    expect(low.stepsKcal).toBe(0);
  });
  it("por debajo del umbral no suma pasos", () => {
    const d = dayTdee({ ...base, activity: { mode: "steps", steps: 1000 } });
    expect(d.stepsKcal).toBe(0);
  });
  it("nivel personalizado y solo TMB", () => {
    expect(
      dayTdee({
        ...base,
        activity: { mode: "level", level: "custom", customFactor: 1.3 },
      }).total,
    ).toBeCloseTo(bmr * 1.3, 6);
    expect(
      dayTdee({ ...base, activity: { mode: "level", level: "bmr_only" } }).total,
    ).toBeCloseTo(bmr, 6);
  });
  it("suma el ejercicio aparte", () => {
    const d = dayTdee({
      ...base,
      activity: { mode: "level", level: "sedentary" },
      exerciseNetKcal: 200,
    });
    expect(d.total).toBeCloseTo(bmr * 1.2 + 200, 6);
    expect(d.exerciseNetKcal).toBe(200);
  });
  it("valida la TMB", () => {
    expect(() => dayTdee({ ...base, bmr: 0, activity: DEFAULT_DAY_ACTIVITY })).toThrow(
      RangeError,
    );
  });
});

describe("resolveDayActivity", () => {
  const steps: DayActivity = { mode: "steps", steps: 5000 };
  const light: DayActivity = { mode: "level", level: "light" };
  const schedule = { 1: steps, 6: light };

  it("usa la semana tipo según el día", () => {
    expect(resolveDayActivity("2026-11-16", schedule)).toBe(steps); // lunes
    expect(resolveDayActivity("2026-11-21", schedule)).toBe(light); // sábado
  });
  it("el ajuste de la fecha reemplaza a la semana tipo", () => {
    const real: DayActivity = { mode: "steps", steps: 12000 };
    expect(resolveDayActivity("2026-11-16", schedule, { "2026-11-16": real })).toBe(real);
  });
  it("sin configuración cae en sedentario", () => {
    expect(resolveDayActivity("2026-11-17", schedule)).toBe(DEFAULT_DAY_ACTIVITY);
  });
});
