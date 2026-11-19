import { describe, expect, it } from "vitest";

import { dayRange, dayToTimestamp, todayIn, toEntries } from "./entries";
import { parseWeightForm } from "./schema";

const today = "2026-11-19";

function errorsOf(input: Record<string, unknown>) {
  const result = parseWeightForm(input, today);
  if (result.success) throw new Error("se esperaba un error");
  return result.errors;
}

describe("parseWeightForm", () => {
  it("acepta datos válidos y la coma decimal", () => {
    const result = parseWeightForm({ weightKg: "70,55", date: today }, today);
    expect(result).toEqual({ success: true, data: { weightKg: 70.55, date: today } });
  });

  it("lee un FormData", () => {
    const fd = new FormData();
    fd.set("weightKg", "80");
    fd.set("date", "2026-11-01");
    expect(parseWeightForm(fd, today).success).toBe(true);
  });

  it("valida el rango del peso", () => {
    expect(errorsOf({ weightKg: "", date: today }).weightKg).toBeDefined();
    expect(errorsOf({ weightKg: "abc", date: today }).weightKg).toBeDefined();
    expect(errorsOf({ weightKg: "19", date: today }).weightKg).toMatch(/20/);
    expect(errorsOf({ weightKg: "401", date: today }).weightKg).toMatch(/400/);
  });

  it("valida la fecha (formato, inexistente y futura)", () => {
    expect(errorsOf({ weightKg: "70", date: "" }).date).toBeDefined();
    expect(errorsOf({ weightKg: "70", date: "19/11/2026" }).date).toBeDefined();
    expect(errorsOf({ weightKg: "70", date: "2026-02-30" }).date).toBeDefined();
    expect(errorsOf({ weightKg: "70", date: "2026-11-20" }).date).toMatch(/futura/);
  });
});

describe("entradas de peso", () => {
  it("calcula IMC y categoría OMS por fila", () => {
    const entries = toEntries(
      [
        { id: "a", measured_at: "2026-11-19T12:00:00+00:00", weight_kg: 68.9 },
        { id: "b", measured_at: "2026-11-01T12:00:00+00:00", weight_kg: 90 },
      ],
      170,
    );
    expect(entries[0]).toMatchObject({ id: "a", day: "2026-11-19", category: "normal" });
    expect(entries[0]?.bmi).toBeCloseTo(23.84, 2);
    expect(entries[1]?.category).toBe("obesity_1");
  });

  it("arma el timestamp y el rango de un día", () => {
    expect(dayToTimestamp("2026-11-19")).toBe("2026-11-19T12:00:00.000Z");
    expect(dayRange("2026-12-31")).toEqual({
      from: "2026-12-31T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
  });

  it("obtiene el día actual en la zona del usuario", () => {
    const now = new Date("2026-11-19T02:00:00Z");
    expect(todayIn("America/Santiago", now)).toBe("2026-11-18");
    expect(todayIn("UTC", now)).toBe("2026-11-19");
    expect(todayIn("Marte/Olimpo", now)).toBe("2026-11-19");
  });
});
