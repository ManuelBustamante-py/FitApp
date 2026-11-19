import { describe, expect, it } from "vitest";
import {
  ageOn,
  bmr,
  bmrComparison,
  cunningham,
  harrisBenedict,
  katchMcArdle,
  leanMassKg,
  mifflinStJeor,
  type BmrInput,
} from "./bmr";

/** Caso de referencia de docs/03: 101 kg, 175 cm, 23 años, hombre. */
const reference: BmrInput = { sex: "male", weightKg: 101, heightCm: 175, ageYears: 23 };
const female: BmrInput = { sex: "female", weightKg: 70, heightCm: 165, ageYears: 30 };

describe("Mifflin-St Jeor", () => {
  it("caso de referencia ≈ 1.994 kcal/día", () => {
    expect(mifflinStJeor(reference)).toBeCloseTo(1993.75, 6);
  });

  it("mujer: 10·P + 6,25·E − 5·A − 161", () => {
    expect(mifflinStJeor(female)).toBeCloseTo(700 + 1031.25 - 150 - 161, 6);
  });

  it("rechaza edad, peso o estatura no positivos", () => {
    expect(() => mifflinStJeor({ ...reference, ageYears: 0 })).toThrow(RangeError);
    expect(() => mifflinStJeor({ ...reference, weightKg: -5 })).toThrow(RangeError);
    expect(() => mifflinStJeor({ ...reference, heightCm: 0 })).toThrow(RangeError);
  });
});

describe("Harris-Benedict revisada", () => {
  it("caso de referencia ≈ 2.151 kcal/día", () => {
    expect(harrisBenedict(reference)).toBeCloseTo(2150.71, 1);
  });

  it("mujer", () => {
    expect(harrisBenedict(female)).toBeCloseTo(447.593 + 647.29 + 511.17 - 129.9, 2);
  });
});

describe("Katch-McArdle y Cunningham", () => {
  const withFat: BmrInput = { ...reference, bodyFatPct: 30 };

  it("masa libre de grasa = P × (1 − %grasa/100)", () => {
    expect(leanMassKg(101, 30)).toBeCloseTo(70.7, 6);
  });

  it("Katch-McArdle = 370 + 21,6 · MLG", () => {
    expect(katchMcArdle(withFat)).toBeCloseTo(370 + 21.6 * 70.7, 6);
  });

  it("Cunningham = 500 + 22 · MLG", () => {
    expect(cunningham(withFat)).toBeCloseTo(500 + 22 * 70.7, 6);
  });

  it("exigen un % de grasa válido", () => {
    expect(() => katchMcArdle(reference)).toThrow(/bodyFatPct/);
    expect(() => cunningham({ ...reference, bodyFatPct: 100 })).toThrow(RangeError);
    expect(() => leanMassKg(101, -1)).toThrow(RangeError);
  });
});

describe("bmr", () => {
  it("despacha a la fórmula elegida", () => {
    const input: BmrInput = { ...reference, bodyFatPct: 30, measuredKcal: 2100 };
    expect(bmr("mifflin", input)).toBe(mifflinStJeor(input));
    expect(bmr("harris_benedict", input)).toBe(harrisBenedict(input));
    expect(bmr("katch_mcardle", input)).toBe(katchMcArdle(input));
    expect(bmr("cunningham", input)).toBe(cunningham(input));
    expect(bmr("measured", input)).toBe(2100);
  });

  it("valor medido: exige un número positivo", () => {
    expect(() => bmr("measured", reference)).toThrow(/measuredKcal/);
    expect(() => bmr("measured", { ...reference, measuredKcal: 0 })).toThrow(RangeError);
  });
});

describe("bmrComparison", () => {
  it("solo incluye las fórmulas que los datos permiten", () => {
    const result = bmrComparison(reference);
    expect(Object.keys(result)).toEqual(["mifflin", "harris_benedict"]);
    expect(result.mifflin).toBeCloseTo(1993.75, 6);
  });

  it("incluye todas si hay % de grasa y valor medido", () => {
    const result = bmrComparison({ ...reference, bodyFatPct: 30, measuredKcal: 2100 });
    expect(Object.keys(result)).toHaveLength(5);
  });
});

describe("ageOn", () => {
  it("cuenta años cumplidos", () => {
    expect(ageOn("2003-05-10", "2026-05-09")).toBe(22);
    expect(ageOn("2003-05-10", "2026-05-10")).toBe(23);
    expect(ageOn("2003-05-10", "2026-11-19")).toBe(23);
    expect(ageOn("2003-12-01", "2026-11-30")).toBe(22);
  });

  it("acepta Date y usa hoy por defecto", () => {
    expect(ageOn(new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2010, 0, 1)))).toBe(
      10,
    );
    expect(ageOn("2000-01-01")).toBeGreaterThanOrEqual(26);
  });

  it("rechaza fechas inválidas o futuras", () => {
    expect(() => ageOn("no-es-fecha", "2026-01-01")).toThrow(RangeError);
    expect(() => ageOn("2030-01-01", "2026-01-01")).toThrow(RangeError);
  });
});
