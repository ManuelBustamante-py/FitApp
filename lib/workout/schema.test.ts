import { describe, expect, it } from "vitest";

import { parseWorkoutForm } from "./schema";

const today = "2026-11-19";
const valid = {
  activityTypeId: "6",
  date: "2026-11-19",
  durationMin: "17",
  hrAvg: "137",
  machineKcal: "77",
};

describe("parseWorkoutForm", () => {
  it("acepta la sesión de referencia y deja los opcionales en null", () => {
    expect(parseWorkoutForm(valid, today)).toEqual({
      success: true,
      data: {
        activityTypeId: 6,
        date: "2026-11-19",
        durationMin: 17,
        hrAvg: 137,
        hrMin: null,
        hrMax: null,
        machineKcal: 77,
        distanceKm: null,
        rpe: null,
        notes: null,
      },
    });
  });

  it("acepta FormData, coma decimal y todos los campos", () => {
    const form = new FormData();
    for (const [k, v] of Object.entries({
      ...valid,
      durationMin: "17,5",
      hrMin: "130",
      hrMax: "145",
      distanceKm: "5,6",
      rpe: "7",
      notes: "  Spinning  ",
    }))
      form.set(k, v);
    const result = parseWorkoutForm(form, today);
    expect(result.success && result.data).toMatchObject({
      durationMin: 17.5,
      hrMin: 130,
      hrMax: 145,
      distanceKm: 5.6,
      rpe: 7,
      notes: "Spinning",
    });
  });

  it("pulso y máquina son opcionales", () => {
    const result = parseWorkoutForm({ ...valid, hrAvg: "", machineKcal: " " }, today);
    expect(result.success && result.data).toMatchObject({
      hrAvg: null,
      machineKcal: null,
    });
  });

  it("rechaza campos obligatorios faltantes o inválidos", () => {
    const result = parseWorkoutForm({ date: "2026-02-30", durationMin: "0" }, today);
    expect(result).toEqual({
      success: false,
      errors: {
        activityTypeId: "Elige una actividad.",
        date: "Ingresa una fecha válida.",
        durationMin: "Ingresa la duración en minutos (entre 0,1 y 1.440).",
      },
    });
  });

  it("rechaza fechas futuras y duraciones mayores a un día", () => {
    const result = parseWorkoutForm(
      { ...valid, date: "2026-11-20", durationMin: "1441" },
      today,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.date).toBe("La fecha no puede ser futura.");
      expect(result.errors.durationMin).toBeDefined();
    }
  });

  it("valida rangos de pulso, máquina, distancia, RPE y notas", () => {
    const result = parseWorkoutForm(
      {
        ...valid,
        hrAvg: "20",
        machineKcal: "-1",
        distanceKm: "abc",
        rpe: "11",
        notes: "x".repeat(1001),
      },
      today,
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(Object.keys(result.errors).sort()).toEqual([
        "distanceKm",
        "hrAvg",
        "machineKcal",
        "notes",
        "rpe",
      ]);
  });

  it("exige mínimo ≤ promedio ≤ máximo", () => {
    const bad = parseWorkoutForm({ ...valid, hrMin: "140", hrMax: "130" }, today);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.errors.hrMin).toBe("El mínimo no puede superar al promedio.");
      expect(bad.errors.hrMax).toBe("El máximo no puede ser menor que el promedio.");
    }
    const noAvg = parseWorkoutForm(
      { ...valid, hrAvg: "", hrMin: "140", hrMax: "130" },
      today,
    );
    expect(!noAvg.success && noAvg.errors.hrMax).toBe(
      "El máximo no puede ser menor que el mínimo.",
    );
  });
});
