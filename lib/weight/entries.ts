import { bmi, bmiCategory, type BmiCategory } from "@/lib/calc";

export const BMI_CATEGORY_LABELS: Record<BmiCategory, string> = {
  underweight: "Bajo peso",
  normal: "Peso normal",
  overweight: "Sobrepeso",
  obesity_1: "Obesidad grado I",
  obesity_2: "Obesidad grado II",
  obesity_3: "Obesidad grado III",
};

/** Hora fija (mediodía UTC) con la que se guarda un peso: así el día no cambia con la zona. */
export function dayToTimestamp(day: string): string {
  return `${day}T12:00:00.000Z`;
}

/** Rango [inicio, fin) UTC que cubre el día calendario `day`. */
export function dayRange(day: string): { from: string; to: string } {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { from: `${day}T00:00:00.000Z`, to: next.toISOString() };
}

/** Día actual (AAAA-MM-DD) en una zona horaria IANA; UTC si la zona no es válida. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export interface WeightEntry {
  id: string;
  day: string;
  weightKg: number;
  bmi: number;
  category: BmiCategory;
}

/** Convierte filas de `body_measurement` en entradas con IMC y categoría OMS. */
export function toEntries(
  rows: readonly { id: string; measured_at: string; weight_kg: number }[],
  heightCm: number,
): WeightEntry[] {
  return rows.map((row) => {
    const value = bmi(row.weight_kg, heightCm);
    return {
      id: row.id,
      day: row.measured_at.slice(0, 10),
      weightKg: row.weight_kg,
      bmi: value,
      category: bmiCategory(value),
    };
  });
}
