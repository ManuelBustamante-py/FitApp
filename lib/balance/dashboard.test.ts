import { describe, expect, it } from "vitest";

import { macroShares, ringFraction } from "./dashboard";

describe("ringFraction", () => {
  it("calcula consumido / meta", () => expect(ringFraction(500, 2000)).toBe(0.25));
  it("se acota a 1 al pasarse", () => expect(ringFraction(2500, 2000)).toBe(1));
  it("es 0 sin meta o sin ingesta", () => {
    expect(ringFraction(500, 0)).toBe(0);
    expect(ringFraction(0, 2000)).toBe(0);
    expect(ringFraction(Number.NaN, 2000)).toBe(0);
  });
});

describe("macroShares", () => {
  it("reparte por kcal de Atwater", () => {
    const [p, c, f] = macroShares({ kcal: 0, proteinG: 25, carbG: 25, fatG: 100 / 9 });
    expect(p.pct).toBeCloseTo(100 / 3);
    expect(c.pct).toBeCloseTo(100 / 3);
    expect(f.pct).toBeCloseTo(100 / 3);
    expect(p.grams).toBe(25);
  });
  it("devuelve 0 % sin ingesta", () => {
    expect(
      macroShares({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0 }).map((m) => m.pct),
    ).toEqual([0, 0, 0]);
  });
});
