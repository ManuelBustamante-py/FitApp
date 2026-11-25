import { describe, expect, it } from "vitest";

import {
  activityMaps,
  addDays,
  balanceStatus,
  bodyOn,
  computeBalanceRange,
  daysBetween,
  exerciseByDay,
  intakeByDay,
  isIsoDay,
  rowDay,
  weekStart,
  weekSummary,
  type BalanceData,
  type DayBalance,
} from "./compute";

const noon = (day: string) => `${day}T12:00:00.000Z`;

/** Caso de referencia de docs/03 §3.4: hombre, 175 cm, 23 años, 101 kg → TMB 1.993,75. */
function makeData(overrides: Partial<BalanceData> = {}): BalanceData {
  return {
    profile: {
      sex: "male",
      birth_date: "2003-05-01",
      height_cm: 175,
      bmr_formula: "mifflin",
      bmr_measured_kcal: null,
      stride_m: null,
      sedentary_steps_threshold: 2500,
    },
    goal: null,
    measurements: [
      { measured_at: noon("2026-11-01"), weight_kg: 101, body_fat_pct: null },
    ],
    schedule: [],
    overrides: [],
    workouts: [],
    meals: [],
    ...overrides,
  };
}

const BMR = 1993.75;

describe("utilidades de fecha", () => {
  it("isIsoDay valida formato y fecha real", () => {
    expect(isIsoDay("2026-11-23")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-1-3")).toBe(false);
    expect(isIsoDay("hoy")).toBe(false);
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(() => addDays("x", 1)).toThrow(RangeError);
  });

  it("weekStart devuelve el lunes ISO", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23"); // lunes
    expect(weekStart("2026-11-25")).toBe("2026-11-23"); // miércoles
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // domingo
    expect(weekStart("2026-12-02")).toBe("2026-11-30");
  });

  it("daysBetween incluye ambos extremos y rechaza rangos invertidos", () => {
    expect(daysBetween("2026-11-29", "2026-12-01")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
    ]);
    expect(daysBetween("2026-11-25", "2026-11-25")).toEqual(["2026-11-25"]);
    expect(() => daysBetween("2026-11-26", "2026-11-25")).toThrow(RangeError);
    expect(() => daysBetween("2026-11-25", "mal")).toThrow(RangeError);
  });

  it("rowDay toma la fecha guardada a mediodía UTC", () => {
    expect(rowDay("2026-11-25T12:00:00+00:00")).toBe("2026-11-25");
  });
});

describe("bodyOn", () => {
  const rows = [
    { measured_at: noon("2026-11-10"), weight_kg: 100, body_fat_pct: 30 },
    { measured_at: noon("2026-11-20"), weight_kg: 99, body_fat_pct: null },
    { measured_at: noon("2026-11-15"), weight_kg: 99.5, body_fat_pct: null },
  ];

  it("usa el último peso y el último % de grasa hasta el día, sin importar el orden", () => {
    expect(bodyOn("2026-11-25", rows)).toEqual({ weightKg: 99, bodyFatPct: 30 });
    expect(bodyOn("2026-11-16", rows)).toEqual({ weightKg: 99.5, bodyFatPct: 30 });
    expect(bodyOn("2026-11-10", rows)).toEqual({ weightKg: 100, bodyFatPct: 30 });
  });

  it("ignora mediciones posteriores al día", () => {
    expect(bodyOn("2026-11-09", rows)).toEqual({ weightKg: null, bodyFatPct: null });
  });
});

describe("activityMaps", () => {
  it("convierte semana tipo y ajustes, descartando filas inconsistentes", () => {
    const maps = activityMaps(
      [
        {
          weekday: 1,
          mode: "steps",
          level: null,
          custom_factor: null,
          steps_target: 5000,
        },
        {
          weekday: 2,
          mode: "level",
          level: "custom",
          custom_factor: null,
          steps_target: null,
        },
        {
          weekday: 3,
          mode: "level",
          level: "light",
          custom_factor: null,
          steps_target: null,
        },
      ],
      [
        {
          day: "2026-11-25",
          mode: "steps",
          level: null,
          custom_factor: null,
          steps_actual: 8000,
        },
      ],
    );
    expect(maps.schedule[1]).toEqual({ mode: "steps", steps: 5000 });
    expect(maps.schedule[2]).toBeUndefined();
    expect(maps.schedule[3]).toMatchObject({ mode: "level", level: "light" });
    expect(maps.overrides["2026-11-25"]).toEqual({ mode: "steps", steps: 8000 });
  });
});

describe("intakeByDay y exerciseByDay", () => {
  it("agrupa ítems de varias comidas por día", () => {
    const map = intakeByDay([
      {
        eaten_at: noon("2026-11-25"),
        meal_item: [
          { kcal: 300.04, protein_g: 10, carb_g: 40, fat_g: 5 },
          { kcal: 200, protein_g: 5.1, carb_g: 30, fat_g: 2 },
        ],
      },
      {
        eaten_at: noon("2026-11-25"),
        meal_item: [{ kcal: 100, protein_g: 1, carb_g: 2, fat_g: 3 }],
      },
      { eaten_at: noon("2026-11-24"), meal_item: [] },
    ]);
    expect(map.get("2026-11-25")).toEqual({
      totals: { kcal: 600, proteinG: 16.1, carbG: 72, fatG: 10 },
      itemCount: 3,
    });
    expect(map.get("2026-11-24")).toEqual({
      totals: { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
      itemCount: 0,
    });
  });

  it("suma el ejercicio neto por día y nunca resta", () => {
    const map = exerciseByDay([
      { started_at: noon("2026-11-25"), kcal_net: 250 },
      { started_at: noon("2026-11-25"), kcal_net: 100 },
      { started_at: noon("2026-11-24"), kcal_net: -5 },
    ]);
    expect(map.get("2026-11-25")).toBe(350);
    expect(map.get("2026-11-24")).toBe(0);
  });
});

describe("balanceStatus", () => {
  it("déficit, superávit o equilibrio (< 1 kcal)", () => {
    expect(balanceStatus(-500)).toBe("deficit");
    expect(balanceStatus(120)).toBe("surplus");
    expect(balanceStatus(0.4)).toBe("even");
    expect(balanceStatus(-0.9)).toBe("even");
  });
});

describe("computeBalanceRange", () => {
  it("sin semana tipo usa sedentario: TDEE = TMB × 1,2 (≈ 2.393)", () => {
    const [day] = computeBalanceRange("2026-11-28", "2026-11-28", makeData());
    expect(day.energy?.bmr).toBeCloseTo(BMR, 6);
    expect(day.energy?.factor).toBe(1.2);
    expect(day.energy?.tdee).toBeCloseTo(BMR * 1.2, 6);
    expect(day.itemCount).toBe(0);
    expect(day.balanceKcal).toBeCloseTo(-BMR * 1.2, 6);
    expect(day.target).toBeNull();
    expect(day.remainingKcal).toBeCloseTo(BMR * 1.2, 6);
    expect(day.belowMinimum).toBe(false);
  });

  it("HU-07: 5.000 pasos L-V ≈ 2.484 y sedentario el fin de semana ≈ 2.393", () => {
    const schedule = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      mode: "steps",
      level: null,
      custom_factor: null,
      steps_target: 5000,
    }));
    const days = computeBalanceRange("2026-11-27", "2026-11-28", makeData({ schedule }));
    expect(days[0].energy?.tdee).toBeCloseTo(2484, -1); // viernes
    expect(days[0].energy?.stepsKcal).toBeGreaterThan(90);
    expect(days[1].energy?.tdee).toBeCloseTo(2393, -1); // sábado
  });

  it("suma ejercicio neto, ingesta y meta; el ajuste del día reemplaza la semana tipo", () => {
    const data = makeData({
      goal: { target_weight_kg: 80, weekly_rate_kg: -0.5 },
      schedule: [
        {
          weekday: 3,
          mode: "level",
          level: "moderate",
          custom_factor: null,
          steps_target: null,
        },
      ],
      overrides: [
        {
          day: "2026-11-25",
          mode: "level",
          level: "light",
          custom_factor: null,
          steps_actual: null,
        },
      ],
      workouts: [{ started_at: noon("2026-11-25"), kcal_net: 300 }],
      meals: [
        {
          eaten_at: noon("2026-11-25"),
          meal_item: [{ kcal: 1800, protein_g: 120, carb_g: 180, fat_g: 60 }],
        },
      ],
    });
    const [day] = computeBalanceRange("2026-11-25", "2026-11-25", data);
    const tdee = BMR * 1.375 + 300;
    expect(day.energy).toMatchObject({
      factor: 1.375,
      exerciseNetKcal: 300,
      weightKg: 101,
    });
    expect(day.energy?.tdee).toBeCloseTo(tdee, 6);
    expect(day.intake).toEqual({ kcal: 1800, proteinG: 120, carbG: 180, fatG: 60 });
    expect(day.balanceKcal).toBeCloseTo(1800 - tdee, 6);
    expect(day.status).toBe("deficit");
    expect(day.target?.mode).toBe("lose");
    expect(day.target?.kcal).toBeCloseTo(tdee - 550, 6);
    expect(day.remainingKcal).toBeCloseTo(tdee - 550 - 1800, 6);
  });

  it("superávit y aviso de ingesta bajo el mínimo", () => {
    const meals = [
      {
        eaten_at: noon("2026-11-24"),
        meal_item: [{ kcal: 3000, protein_g: 0, carb_g: 0, fat_g: 0 }],
      },
      {
        eaten_at: noon("2026-11-25"),
        meal_item: [{ kcal: 900, protein_g: 0, carb_g: 0, fat_g: 0 }],
      },
    ];
    const [mon, tue] = computeBalanceRange(
      "2026-11-24",
      "2026-11-25",
      makeData({ meals }),
    );
    expect(mon.status).toBe("surplus");
    expect(mon.belowMinimum).toBe(false);
    expect(tue.status).toBe("deficit");
    expect(tue.belowMinimum).toBe(true);
  });

  it("sin peso hasta el día no hay gasto ni balance, pero sí ingesta", () => {
    const data = makeData({
      measurements: [
        { measured_at: noon("2026-11-25"), weight_kg: 101, body_fat_pct: null },
      ],
      meals: [
        {
          eaten_at: noon("2026-11-24"),
          meal_item: [{ kcal: 1000, protein_g: 1, carb_g: 1, fat_g: 1 }],
        },
      ],
    });
    const [before, on] = computeBalanceRange("2026-11-24", "2026-11-25", data);
    expect(before).toMatchObject({
      energy: null,
      balanceKcal: null,
      status: null,
      target: null,
      remainingKcal: null,
      itemCount: 1,
      belowMinimum: true,
    });
    expect(on.energy?.weightKg).toBe(101);
  });

  it("usa el peso vigente de cada día y la fórmula del perfil", () => {
    const data = makeData({
      profile: { ...makeData().profile, bmr_formula: "katch_mcardle", stride_m: 0.8 },
      measurements: [
        { measured_at: noon("2026-11-01"), weight_kg: 100, body_fat_pct: 30 },
        { measured_at: noon("2026-11-25"), weight_kg: 98, body_fat_pct: null },
      ],
    });
    const [before, on] = computeBalanceRange("2026-11-24", "2026-11-25", data);
    expect(before.energy?.bmr).toBeCloseTo(370 + 21.6 * 70, 6);
    expect(on.energy?.bmr).toBeCloseTo(370 + 21.6 * 98 * 0.7, 6);
  });

  it("usa el largo de paso del perfil si existe", () => {
    const steps = [
      {
        day: "2026-11-25",
        mode: "steps",
        level: null,
        custom_factor: null,
        steps_actual: 12500,
      },
    ];
    const custom = makeData({
      overrides: steps,
      profile: { ...makeData().profile, stride_m: 1 },
    });
    const [day] = computeBalanceRange("2026-11-25", "2026-11-25", custom);
    // 10.000 pasos sobre el umbral × 1 m = 10 km × 101 kg × 0,5
    expect(day.energy?.stepsKcal).toBeCloseTo(505, 6);
  });
});

describe("weekSummary", () => {
  const goal = { target_weight_kg: 80, weekly_rate_kg: -0.5 };
  const meal = (day: string, kcal: number) => ({
    eaten_at: noon(day),
    meal_item: [{ kcal, protein_g: 0, carb_g: 0, fat_g: 0 }],
  });

  it("acumula solo los días con comidas y gasto", () => {
    const data = makeData({
      goal,
      meals: [meal("2026-11-23", 1893.5), meal("2026-11-25", 2592.5)],
    });
    const days = computeBalanceRange("2026-11-23", "2026-11-25", data);
    const tdee = BMR * 1.2; // 2.392,5
    const summary = weekSummary(days);
    expect(summary.from).toBe("2026-11-23");
    expect(summary.to).toBe("2026-11-25");
    expect(summary.countedDays).toBe(2);
    expect(summary.balanceKcal).toBeCloseTo(1893.5 - tdee + 2592.5 - tdee, 6);
    expect(summary.deficitKcal).toBeCloseTo(-(1893.5 - tdee + 2592.5 - tdee), 6);
    expect(summary.targetDeficitKcal).toBeCloseTo(1100, 6);
  });

  it("sin días contados: acumulado 0 y sin déficit meta", () => {
    const days = computeBalanceRange("2026-11-23", "2026-11-24", makeData({ goal }));
    expect(weekSummary(days)).toEqual({
      from: "2026-11-23",
      to: "2026-11-24",
      countedDays: 0,
      balanceKcal: 0,
      deficitKcal: 0,
      targetDeficitKcal: null,
    });
  });

  it("sin meta activa el déficit meta es null", () => {
    const days = computeBalanceRange(
      "2026-11-23",
      "2026-11-23",
      makeData({ meals: [meal("2026-11-23", 2000)] }),
    );
    expect(weekSummary(days).targetDeficitKcal).toBeNull();
    expect(weekSummary(days).countedDays).toBe(1);
  });

  it("no cuenta días con comidas pero sin peso", () => {
    const day: DayBalance = {
      day: "2026-11-23",
      intake: { kcal: 1000, proteinG: 0, carbG: 0, fatG: 0 },
      itemCount: 1,
      energy: null,
      balanceKcal: null,
      status: null,
      target: null,
      remainingKcal: null,
      belowMinimum: true,
    };
    expect(weekSummary([day]).countedDays).toBe(0);
  });

  it("rechaza una lista vacía", () => {
    expect(() => weekSummary([])).toThrow(RangeError);
  });
});
