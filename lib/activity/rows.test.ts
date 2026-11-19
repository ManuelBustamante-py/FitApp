import { describe, expect, it } from "vitest";

import { activityToField, describeActivity, rowToActivity } from "./rows";

describe("rowToActivity", () => {
  it("convierte niveles, personalizado y pasos", () => {
    expect(
      rowToActivity({ mode: "level", level: "light", custom_factor: null, steps: null }),
    ).toEqual({ mode: "level", level: "light", customFactor: null });
    expect(
      rowToActivity({ mode: "steps", level: null, custom_factor: null, steps: 5000 }),
    ).toEqual({ mode: "steps", steps: 5000 });
  });
  it("descarta filas inconsistentes", () => {
    expect(
      rowToActivity({ mode: "steps", level: null, custom_factor: null, steps: null }),
    ).toBeNull();
    expect(
      rowToActivity({ mode: "level", level: null, custom_factor: null, steps: null }),
    ).toBeNull();
    expect(
      rowToActivity({ mode: "level", level: "x", custom_factor: null, steps: null }),
    ).toBeNull();
    expect(
      rowToActivity({ mode: "level", level: "custom", custom_factor: null, steps: null }),
    ).toBeNull();
    expect(
      rowToActivity({ mode: "otro", level: "light", custom_factor: null, steps: null }),
    ).toBeNull();
  });
});

describe("activityToField / describeActivity", () => {
  it("ida y vuelta al selector", () => {
    expect(activityToField({ mode: "steps", steps: 5000 })).toEqual({
      kind: "steps",
      value: "5000",
    });
    expect(
      activityToField({ mode: "level", level: "custom", customFactor: 1.3 }),
    ).toEqual({ kind: "custom", value: "1.3" });
    expect(activityToField({ mode: "level", level: "light" })).toEqual({
      kind: "light",
      value: "",
    });
  });
  it("describe la actividad", () => {
    expect(describeActivity({ mode: "steps", steps: 5000 })).toMatch(/pasos/);
    expect(describeActivity({ mode: "level", level: "custom", customFactor: 1.3 })).toBe(
      "Personalizado (1,3)",
    );
    expect(describeActivity({ mode: "level", level: "sedentary" })).toBe(
      "Sedentario (1,2)",
    );
  });
});
