import { describe, expect, it } from "vitest";

import type { DayBalance } from "@/lib/balance/compute";

import {
  buildBalanceSeries,
  buildWeightSeries,
  movingAverage,
  parseRange,
  rangeBounds,
} from "./series";

describe("parseRange", () => {
  it("acepta 7, 30 y 90", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange(["30"])).toBe(30);
  });
  it("usa 30 ante valores inválidos", () => {
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange("15")).toBe(30);
    expect(parseRange("abc")).toBe(30);
  });
});

describe("rangeBounds", () => {
  it("incluye hoy y cubre exactamente N días", () => {
    expect(rangeBounds("2026-03-10", 7)).toEqual({
      from: "2026-03-04",
      to: "2026-03-10",
    });
    expect(rangeBounds("2026-03-01", 30).from).toBe("2026-01-31");
  });
});

describe("movingAverage", () => {
  it("promedia la ventana ignorando huecos", () => {
    expect(movingAverage([70, null, 72, null], 3)).toEqual([70, 70, 71, 72]);
  });
  it("es null si la ventana está vacía", () => {
    expect(movingAverage([null, null, 70], 2)).toEqual([null, null, 70]);
  });
  it("descarta valores fuera de la ventana", () => {
    expect(movingAverage([80, 70, 70], 2)).toEqual([80, 75, 70]);
  });
});

describe("buildWeightSeries", () => {
  const rows = [
    { measured_at: "2026-03-03T12:00:00.000Z", weight_kg: 80 },
    { measured_at: "2026-03-05T12:00:00.000Z", weight_kg: 78 },
    { measured_at: "2026-03-05T18:00:00.000Z", weight_kg: 79 },
  ];
  const series = buildWeightSeries("2026-03-05", "2026-03-07", rows, 175);

  it("devuelve un punto por día del rango", () => {
    expect(series.map((p) => p.day)).toEqual(["2026-03-05", "2026-03-06", "2026-03-07"]);
  });
  it("usa el último peso del día y el calentamiento previo en el promedio", () => {
    expect(series[0].weightKg).toBe(79);
    expect(series[0].avgKg).toBe(79.5);
    expect(series[1].weightKg).toBeNull();
    expect(series[1].bmi).toBeNull();
    expect(series[2].avgKg).toBe(79.5);
  });
  it("calcula el IMC con la altura", () => {
    expect(series[0].bmi).toBe(25.8);
  });
});

describe("buildBalanceSeries", () => {
  const base = {
    intake: { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
    status: null,
    target: null,
    remainingKcal: null,
    belowMinimum: false,
  };
  const day = (over: Partial<DayBalance>): DayBalance => ({
    day: "2026-03-01",
    itemCount: 0,
    energy: null,
    balanceKcal: null,
    ...base,
    ...over,
  });

  it("invierte el signo del balance y omite días sin comidas", () => {
    const out = buildBalanceSeries([
      day({ itemCount: 3, balanceKcal: -400.4 }),
      day({ itemCount: 2, balanceKcal: 250 }),
      day({ itemCount: 0, balanceKcal: -2000 }),
      day({ itemCount: 1, balanceKcal: null }),
    ]);
    expect(out.map((p) => p.deficitKcal)).toEqual([400, -250, null, null]);
    expect(out[0].exerciseKcal).toBe(0);
  });
});
