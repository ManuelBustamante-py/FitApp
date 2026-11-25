import { bmi } from "@/lib/calc";
import { addDays, daysBetween, type DayBalance } from "@/lib/balance/compute";

/** Rangos del selector (días). El máximo coincide con `MAX_RANGE_DAYS` del balance. */
export const TREND_RANGES = [7, 30, 90] as const;
export type TrendRange = (typeof TREND_RANGES)[number];
export const DEFAULT_RANGE: TrendRange = 30;

/** Ventana del promedio móvil de peso (días corridos). */
export const MOVING_AVERAGE_DAYS = 7;

/** Interpreta `?dias=`: solo 7, 30 o 90; cualquier otra cosa cae al valor por defecto. */
export function parseRange(raw: string | string[] | undefined): TrendRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return (TREND_RANGES as readonly number[]).includes(n)
    ? (n as TrendRange)
    : DEFAULT_RANGE;
}

/** Primer y último día (inclusive) de los últimos `days` días que terminan en `today`. */
export function rangeBounds(today: string, days: number): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}

/**
 * Promedio móvil: para cada posición, media de los valores no nulos de las últimas
 * `window` posiciones (incluida la actual). null si la ventana no tiene valores.
 */
export function movingAverage(
  values: readonly (number | null)[],
  window = MOVING_AVERAGE_DAYS,
): (number | null)[] {
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = values[j];
      if (v !== null) {
        sum += v;
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  });
}

export interface WeightRow {
  measured_at: string;
  weight_kg: number;
}

export interface WeightPoint {
  day: string;
  /** Peso registrado ese día (el último, si hay varios); null si no hay. */
  weightKg: number | null;
  /** Promedio móvil de 7 días; null si no hay pesos en la ventana. */
  avgKg: number | null;
  /** IMC del peso registrado ese día; null si no hay. */
  bmi: number | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Serie diaria de peso, promedio móvil e IMC para los días `from`..`to`.
 * `rows` puede incluir pesos de hasta `window - 1` días antes de `from`
 * (para que el promedio del primer día sea completo).
 */
export function buildWeightSeries(
  from: string,
  to: string,
  rows: readonly WeightRow[],
  heightCm: number,
  window = MOVING_AVERAGE_DAYS,
): WeightPoint[] {
  const byDay = new Map<string, number>();
  [...rows]
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    .forEach((r) => byDay.set(r.measured_at.slice(0, 10), r.weight_kg));

  const warmup = daysBetween(addDays(from, -(window - 1)), addDays(from, -1)).length;
  const days = daysBetween(addDays(from, -(window - 1)), to);
  const values = days.map((d) => byDay.get(d) ?? null);
  const avgs = movingAverage(values, window);

  return days.slice(warmup).map((day, i) => {
    const weight = values[warmup + i];
    const avg = avgs[warmup + i];
    return {
      day,
      weightKg: weight,
      avgKg: avg === null ? null : round1(avg),
      bmi: weight === null ? null : round1(bmi(weight, heightCm)),
    };
  });
}

export interface BalancePoint {
  day: string;
  /** Déficit (+) o superávit (−) en kcal; null si el día no cuenta (sin comidas o sin peso). */
  deficitKcal: number | null;
  /** kcal netas quemadas en entrenamientos del día. */
  exerciseKcal: number;
}

/** Series de déficit y ejercicio a partir del balance diario (mismo criterio que el resumen semanal). */
export function buildBalanceSeries(days: readonly DayBalance[]): BalancePoint[] {
  return days.map((d) => ({
    day: d.day,
    deficitKcal:
      d.itemCount > 0 && d.balanceKcal !== null ? Math.round(-d.balanceKcal) : null,
    exerciseKcal: Math.round(d.energy?.exerciseNetKcal ?? 0),
  }));
}
