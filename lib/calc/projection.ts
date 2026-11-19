import { assertNonNegative, assertPositive, KCAL_PER_KG } from "./common";

/** Suavizado por defecto del peso de tendencia (10 % por día). */
export const DEFAULT_TREND_ALPHA = 0.1;

export interface WeightEntry {
  /** Fecha `YYYY-MM-DD`. */
  day: string;
  weightKg: number;
}

export interface TrendPoint extends WeightEntry {
  trendKg: number;
}

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  const time = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(time)) throw new RangeError(`Fecha inválida: ${day}`);
  return Math.round(time / DAY_MS);
}

/**
 * Peso de tendencia: promedio móvil exponencial de los registros (docs/03 §7).
 * Acepta días sin registro: el peso de un hueco de `n` días cuenta como
 * `1 − (1 − α)^n`, igual que si se hubiera aplicado `n` veces. Varios registros
 * del mismo día se aplican en orden. La entrada se ordena por fecha.
 */
export function trendWeights(
  entries: readonly WeightEntry[],
  alpha: number = DEFAULT_TREND_ALPHA,
): TrendPoint[] {
  if (!(alpha > 0 && alpha <= 1))
    throw new RangeError(`alpha debe estar en (0, 1] (recibido: ${alpha})`);
  const sorted = entries
    .map((entry) => ({ ...entry, n: dayNumber(entry.day) }))
    .sort((a, b) => a.n - b.n);

  const result: TrendPoint[] = [];
  let trend: number | null = null;
  let lastDay = 0;
  for (const { day, weightKg, n } of sorted) {
    assertPositive(weightKg, "weightKg");
    if (trend === null) {
      trend = weightKg;
    } else {
      const gap = Math.max(1, n - lastDay);
      const effective = 1 - Math.pow(1 - alpha, gap);
      trend += effective * (weightKg - trend);
    }
    lastDay = n;
    result.push({ day, weightKg, trendKg: trend });
  }
  return result;
}

export interface ProjectionInput {
  /** Peso de partida (de tendencia). */
  weightKg: number;
  /** Ingesta diaria planificada. */
  intakeKcal: number;
  /** TDEE para un peso dado (p. ej., TMB(peso) × factor + extras). */
  tdeeForWeight: (weightKg: number) => number;
  /** Días a proyectar. */
  days: number;
}

export interface ProjectionRange {
  /** Regla clásica de 7.700 kcal/kg con el déficit inicial fijo (sobreestima la baja). */
  linearKg: number;
  /** Recalcula el TDEE cada día con el peso proyectado, así el déficit se achica. */
  adaptiveKg: number;
}

/**
 * Proyección del peso como rango (docs/03 §7). `linearKg` mantiene el déficit
 * del primer día; `adaptiveKg` lo recalcula a diario con el peso proyectado
 * (la TMB baja al bajar de peso). La baja real tiende a quedar en o por sobre
 * `adaptiveKg`, por eso se muestran ambas y se recalcula con el peso real.
 */
export function projectWeight({
  weightKg,
  intakeKcal,
  tdeeForWeight,
  days,
}: ProjectionInput): ProjectionRange {
  assertPositive(weightKg, "weightKg");
  assertNonNegative(intakeKcal, "intakeKcal");
  if (!Number.isInteger(days) || days < 0)
    throw new RangeError(`days debe ser un entero ≥ 0 (recibido: ${days})`);

  const initialBalance = intakeKcal - tdeeForWeight(weightKg);
  const linearKg = weightKg + (initialBalance * days) / KCAL_PER_KG;

  let adaptiveKg = weightKg;
  for (let day = 0; day < days; day += 1) {
    adaptiveKg += (intakeKcal - tdeeForWeight(adaptiveKg)) / KCAL_PER_KG;
  }
  return { linearKg, adaptiveKg };
}

/**
 * Días estimados para llegar a un peso meta con la regla lineal de 7.700 kcal/kg.
 * `null` si el balance no va en la dirección de la meta.
 */
export function daysToGoal(
  currentKg: number,
  goalKg: number,
  dailyBalanceKcal: number,
): number | null {
  assertPositive(currentKg, "currentKg");
  assertPositive(goalKg, "goalKg");
  const deltaKg = goalKg - currentKg;
  if (deltaKg === 0) return 0;
  if (dailyBalanceKcal === 0 || Math.sign(deltaKg) !== Math.sign(dailyBalanceKcal))
    return null;
  return (deltaKg * KCAL_PER_KG) / dailyBalanceKcal;
}
