import { GOAL_REACHED_TOLERANCE_KG, KCAL_PER_KG, MIN_SAFE_INTAKE_KCAL } from "@/lib/calc";
import type { Sex } from "@/lib/calc";

import { addDays, type DayBalance } from "./compute";

/** Ventana de días recientes con la que se calcula el déficit real (docs/03: 14–28 días). */
export const PROJECTION_WINDOW_DAYS = 28;
/** Mínimo de días con comidas y gasto calculable para proyectar. */
export const MIN_PROJECTION_DAYS = 7;
/** Más allá de este horizonte no se muestra fecha: es una estimación sin sentido. */
export const MAX_PROJECTION_DAYS = 730;
/**
 * Margen mínimo relativo del ritmo: aunque el déficit sea muy estable, el gasto
 * se adapta (docs/03 §7), así que el rango nunca se achica de ±20 %.
 */
export const MIN_RELATIVE_MARGIN = 0.2;
/** El extremo lento nunca baja de esta fracción del ritmo medio (evita fechas infinitas). */
export const MIN_SLOW_FRACTION = 0.25;

/** Días con comidas registradas y gasto calculable: los únicos que cuentan. */
export function countedDays(days: readonly DayBalance[]): DayBalance[] {
  return days.filter((d) => d.itemCount > 0 && d.balanceKcal !== null && d.energy);
}

export type ProjectionResult =
  | { status: "no-goal" }
  | { status: "reached" }
  | { status: "few-data"; countedDays: number; minDays: number }
  | { status: "no-progress"; direction: "lose" | "gain"; avgBalanceKcal: number }
  | { status: "too-far"; direction: "lose" | "gain" }
  | {
      status: "ok";
      /** Fecha más temprana (ritmo medio + margen), `YYYY-MM-DD`. */
      from: string;
      /** Fecha más tardía (ritmo medio − margen), `YYYY-MM-DD`. */
      to: string;
      minDays: number;
      maxDays: number;
      direction: "lose" | "gain";
      countedDays: number;
      /** Balance diario medio (negativo = déficit). */
      avgBalanceKcal: number;
      /** Margen de ± kcal/día aplicado al ritmo. */
      marginKcal: number;
    };

export interface ProjectGoalInput {
  /** Peso actual (de tendencia). */
  currentKg: number | null;
  /** Peso meta; null sin meta de peso. */
  goalKg: number | null;
  /** Balances de los últimos días (hasta hoy). */
  days: readonly DayBalance[];
  /** Hoy, `YYYY-MM-DD`. */
  today: string;
}

/**
 * Proyección a la meta como rango de fechas (RF-29, HU-06).
 *
 * Con el balance medio `m` de los días contados (n) y su desviación estándar `s`,
 * el margen es `max(s/√n, 20 % de |m|)`: el error estándar de la media, con un
 * piso por la adaptación del gasto. Días = |Δpeso| × 7.700 / ritmo, con ritmo
 * `|m| + margen` (fecha temprana) y `max(|m| − margen, 25 % de |m|)` (fecha tardía).
 * Sin valor si el balance no va hacia la meta (docs/03 §7).
 */
export function projectGoal({
  currentKg,
  goalKg,
  days,
  today,
}: ProjectGoalInput): ProjectionResult {
  if (goalKg === null || !(goalKg > 0)) return { status: "no-goal" };
  if (currentKg === null || !(currentKg > 0))
    return { status: "few-data", countedDays: 0, minDays: MIN_PROJECTION_DAYS };
  const deltaKg = goalKg - currentKg;
  if (Math.abs(deltaKg) <= GOAL_REACHED_TOLERANCE_KG) return { status: "reached" };

  const counted = countedDays(days);
  if (counted.length < MIN_PROJECTION_DAYS)
    return {
      status: "few-data",
      countedDays: counted.length,
      minDays: MIN_PROJECTION_DAYS,
    };

  const balances = counted.map((d) => d.balanceKcal as number);
  const n = balances.length;
  const mean = balances.reduce((a, b) => a + b, 0) / n;
  const variance = balances.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const direction = deltaKg < 0 ? "lose" : "gain";

  // Déficit (balance negativo) ayuda a bajar; superávit ayuda a subir.
  const pace = direction === "lose" ? -mean : mean;
  if (!(pace > 0)) return { status: "no-progress", direction, avgBalanceKcal: mean };

  const margin = Math.max(Math.sqrt(variance / n), MIN_RELATIVE_MARGIN * pace);
  const fastPace = pace + margin;
  const slowPace = Math.max(pace - margin, MIN_SLOW_FRACTION * pace);
  const needed = Math.abs(deltaKg) * KCAL_PER_KG;
  const minDays = Math.max(1, Math.ceil(needed / fastPace));
  const maxDays = Math.max(minDays, Math.ceil(needed / slowPace));
  if (minDays > MAX_PROJECTION_DAYS) return { status: "too-far", direction };

  return {
    status: "ok",
    from: addDays(today, minDays),
    to: addDays(today, Math.min(maxDays, MAX_PROJECTION_DAYS)),
    minDays,
    maxDays,
    direction,
    countedDays: n,
    avgBalanceKcal: mean,
    marginKcal: margin,
  };
}

export interface IntakeAlert {
  /** Mínimo prudente del sexo (kcal). */
  minKcal: number;
  /** Días con comidas registradas bajo el mínimo en la ventana. */
  daysBelow: number;
  /** Días con comidas registradas en la ventana. */
  loggedDays: number;
}

/**
 * Alerta de ingesta mínima (docs/03 §7): días registrados bajo 1.500 kcal
 * (hombres) o 1.200 kcal (mujeres). El día en curso no cuenta si `today` está
 * dado, porque aún puede estar incompleto. null si ningún día quedó bajo el mínimo.
 */
export function intakeAlert(
  days: readonly DayBalance[],
  sex: Sex,
  today?: string,
): IntakeAlert | null {
  const minKcal = MIN_SAFE_INTAKE_KCAL[sex];
  const logged = days.filter((d) => d.itemCount > 0 && d.day !== today);
  const daysBelow = logged.filter((d) => d.intake.kcal < minKcal).length;
  return daysBelow > 0 ? { minKcal, daysBelow, loggedDays: logged.length } : null;
}
