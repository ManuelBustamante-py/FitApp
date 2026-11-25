import { describe, expect, it } from "vitest";

import type { DayBalance } from "./compute";
import { intakeAlert, projectGoal } from "./projection";

function day(
  date: string,
  intake: number,
  balance: number | null,
  items = 1,
): DayBalance {
  return {
    day: date,
    intake: { kcal: intake, proteinG: 0, carbG: 0, fatG: 0 },
    itemCount: items,
    energy:
      balance === null
        ? null
        : {
            weightKg: 80,
            bmr: 1700,
            factor: 1.2,
            stepsKcal: 0,
            exerciseNetKcal: 0,
            tdee: 2000,
            activity: { mode: "level", level: "sedentary" } as never,
          },
    balanceKcal: balance,
    status: null,
    target: null,
    remainingKcal: null,
    belowMinimum: false,
  };
}

const series = (balances: number[], intake = 1800) =>
  balances.map((b, i) => day(`2026-03-${String(i + 1).padStart(2, "0")}`, intake, b));

const TODAY = "2026-03-14";

describe("projectGoal", () => {
  it("sin meta de peso", () => {
    expect(
      projectGoal({
        currentKg: 80,
        goalKg: null,
        days: series(Array(14).fill(-500)),
        today: TODAY,
      }),
    ).toEqual({ status: "no-goal" });
  });

  it("meta ya alcanzada", () => {
    expect(projectGoal({ currentKg: 70.05, goalKg: 70, days: [], today: TODAY })).toEqual(
      { status: "reached" },
    );
  });

  it("pocos días con datos", () => {
    const r = projectGoal({
      currentKg: 80,
      goalKg: 75,
      days: series(Array(3).fill(-500)),
      today: TODAY,
    });
    expect(r).toMatchObject({ status: "few-data", countedDays: 3 });
  });

  it("ignora días sin comidas o sin gasto", () => {
    const days = [
      ...series(Array(6).fill(-500)),
      day("2026-03-07", 0, -2000, 0),
      day("2026-03-08", 1500, null),
    ];
    expect(projectGoal({ currentKg: 80, goalKg: 75, days, today: TODAY })).toMatchObject({
      status: "few-data",
      countedDays: 6,
    });
  });

  it("déficit nulo o en sentido contrario", () => {
    const flat = projectGoal({
      currentKg: 80,
      goalKg: 75,
      days: series(Array(14).fill(0)),
      today: TODAY,
    });
    expect(flat).toMatchObject({ status: "no-progress", direction: "lose" });
    const surplus = projectGoal({
      currentKg: 80,
      goalKg: 75,
      days: series(Array(14).fill(300)),
      today: TODAY,
    });
    expect(surplus).toMatchObject({ status: "no-progress" });
    const wrong = projectGoal({
      currentKg: 70,
      goalKg: 75,
      days: series(Array(14).fill(-400)),
      today: TODAY,
    });
    expect(wrong).toMatchObject({ status: "no-progress", direction: "gain" });
  });

  it("devuelve un rango con 7.700 kcal/kg y margen mínimo de 20 %", () => {
    const r = projectGoal({
      currentKg: 80,
      goalKg: 75,
      days: series(Array(14).fill(-500)),
      today: TODAY,
    });
    if (r.status !== "ok") throw new Error("se esperaba ok");
    // 5 kg × 7.700 = 38.500 kcal; ritmo 500 ± 100 → 600 (65 d) y 400 (97 d)
    expect(r.minDays).toBe(65);
    expect(r.maxDays).toBe(97);
    expect(r.from).toBe("2026-05-18");
    expect(r.to).toBe("2026-06-19");
    expect(r.from < r.to).toBe(true);
  });

  it("una variabilidad alta ensancha el rango", () => {
    const calm = projectGoal({
      currentKg: 80,
      goalKg: 78,
      days: series(Array(14).fill(-500)),
      today: TODAY,
    });
    const noisy = projectGoal({
      currentKg: 80,
      goalKg: 78,
      days: series([
        -1500, 500, -1200, 200, -900, -100, -1000, 0, -1300, 300, -800, -200, -1100, 100,
      ]),
      today: TODAY,
    });
    if (calm.status !== "ok" || noisy.status !== "ok") throw new Error("se esperaba ok");
    expect(noisy.maxDays - noisy.minDays).toBeGreaterThan(calm.maxDays - calm.minDays);
  });

  it("subir de peso con superávit", () => {
    const r = projectGoal({
      currentKg: 70,
      goalKg: 72,
      days: series(Array(14).fill(400)),
      today: TODAY,
    });
    expect(r).toMatchObject({ status: "ok", direction: "gain" });
  });

  it("una meta lejanísima no da fecha", () => {
    const r = projectGoal({
      currentKg: 150,
      goalKg: 50,
      days: series(Array(14).fill(-50)),
      today: TODAY,
    });
    expect(r).toMatchObject({ status: "too-far" });
  });
});

describe("intakeAlert", () => {
  const days = [
    day("2026-03-01", 1100, -900),
    day("2026-03-02", 1300, -700),
    day("2026-03-03", 1600, -400),
    day("2026-03-04", 0, null, 0),
    day("2026-03-05", 500, -1500),
  ];
  it("usa 1.200 kcal en mujeres y 1.500 en hombres", () => {
    expect(intakeAlert(days, "female", "2026-03-05")).toEqual({
      minKcal: 1200,
      daysBelow: 1,
      loggedDays: 3,
    });
    expect(intakeAlert(days, "male", "2026-03-05")).toMatchObject({
      minKcal: 1500,
      daysBelow: 2,
    });
  });
  it("el día en curso no cuenta y los días sin registro tampoco", () => {
    expect(intakeAlert(days.slice(3), "male", "2026-03-05")).toBeNull();
  });
  it("sin días bajo el mínimo no hay alerta", () => {
    expect(intakeAlert([day("2026-03-03", 1600, -400)], "male")).toBeNull();
  });
});
