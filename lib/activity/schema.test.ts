import { describe, expect, it } from "vitest";

import {
  parseActivityChoice,
  parseBmrForm,
  parseDayAdjustmentForm,
  parseScheduleForm,
  parseStepsSettingsForm,
} from "./schema";

function errorsOf<T, K extends string>(
  r: { success: true; data: T } | { success: false; errors: Partial<Record<K, string>> },
) {
  if (r.success) throw new Error("se esperaba un error");
  return r.errors;
}

describe("parseActivityChoice", () => {
  it("niveles fijos, personalizado y pasos", () => {
    expect(parseActivityChoice("light", "")).toEqual({
      ok: true,
      choice: { mode: "level", level: "light", customFactor: null },
    });
    expect(parseActivityChoice("custom", "1,3")).toMatchObject({
      choice: { level: "custom", customFactor: 1.3 },
    });
    expect(parseActivityChoice("steps", "5000")).toEqual({
      ok: true,
      choice: { mode: "steps", steps: 5000 },
    });
  });
  it("rechaza valores fuera de rango o inválidos", () => {
    expect(parseActivityChoice("custom", "3").ok).toBe(false);
    expect(parseActivityChoice("custom", "").ok).toBe(false);
    expect(parseActivityChoice("steps", "12,5").ok).toBe(false);
    expect(parseActivityChoice("steps", "200000").ok).toBe(false);
    expect(parseActivityChoice("steps", "").ok).toBe(false);
    expect(parseActivityChoice("nada", "").ok).toBe(false);
    expect(parseActivityChoice(null, "").ok).toBe(false);
  });
});

describe("parseBmrForm", () => {
  it("acepta cada fórmula; la medida exige valor", () => {
    expect(parseBmrForm({ bmrFormula: "mifflin", measuredKcal: "" })).toMatchObject({
      success: true,
      data: { formula: "mifflin", measuredKcal: null },
    });
    expect(
      parseBmrForm({ bmrFormula: "measured", measuredKcal: "1850,5" }),
    ).toMatchObject({ success: true, data: { measuredKcal: 1850.5 } });
    expect(errorsOf(parseBmrForm({ bmrFormula: "measured" })).measuredKcal).toBeDefined();
  });
  it("valida fórmula y rango", () => {
    expect(errorsOf(parseBmrForm({ bmrFormula: "x" })).bmrFormula).toBeDefined();
    expect(
      errorsOf(parseBmrForm({ bmrFormula: "mifflin", measuredKcal: "100" })).measuredKcal,
    ).toBeDefined();
  });
  it("lee un FormData", () => {
    const fd = new FormData();
    fd.set("bmrFormula", "harris_benedict");
    expect(parseBmrForm(fd).success).toBe(true);
  });
});

describe("parseStepsSettingsForm", () => {
  it("umbral entero y largo de paso opcional", () => {
    expect(parseStepsSettingsForm({ thresholdSteps: "2500", strideM: "" })).toEqual({
      success: true,
      data: { thresholdSteps: 2500, strideM: null },
    });
    expect(parseStepsSettingsForm({ thresholdSteps: "3000", strideM: "0,72" })).toEqual({
      success: true,
      data: { thresholdSteps: 3000, strideM: 0.72 },
    });
  });
  it("valida rangos", () => {
    const e = errorsOf(parseStepsSettingsForm({ thresholdSteps: "-1", strideM: "2" }));
    expect(e.thresholdSteps).toBeDefined();
    expect(e.strideM).toBeDefined();
    expect(
      errorsOf(parseStepsSettingsForm({ thresholdSteps: "", strideM: "" }))
        .thresholdSteps,
    ).toBeDefined();
  });
});

describe("parseScheduleForm", () => {
  const week = (over: Record<string, string> = {}) => {
    const o: Record<string, string> = {};
    for (let d = 1; d <= 7; d++) {
      o[`kind${d}`] = d <= 5 ? "steps" : "sedentary";
      o[`value${d}`] = d <= 5 ? "5000" : "";
    }
    return { ...o, ...over };
  };
  it("parsea los 7 días", () => {
    const r = parseScheduleForm(week());
    if (!r.success) throw new Error("inválido");
    expect(r.data).toHaveLength(7);
    expect(r.data[0]?.choice).toEqual({ mode: "steps", steps: 5000 });
    expect(r.data[6]?.choice).toMatchObject({ level: "sedentary" });
  });
  it("informa el día con error", () => {
    expect(errorsOf(parseScheduleForm(week({ value3: "x" }))).day3).toBeDefined();
  });
});

describe("parseDayAdjustmentForm", () => {
  it("fecha y actividad válidas", () => {
    expect(
      parseDayAdjustmentForm({ day: "2026-11-20", kind: "steps", value: "9000" }),
    ).toEqual({
      success: true,
      data: { day: "2026-11-20", choice: { mode: "steps", steps: 9000 } },
    });
  });
  it("valida fecha y valor", () => {
    const e = errorsOf(
      parseDayAdjustmentForm({ day: "2026-02-30", kind: "custom", value: "" }),
    );
    expect(e.day).toBeDefined();
    expect(e.value).toBeDefined();
  });
});
