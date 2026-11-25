import { rowToActivity } from "@/lib/activity/rows";
import {
  dailyBalance,
  dailyTargetKcal,
  dayTdee,
  isIntakeBelowMinimum,
  resolveDayActivity,
  strideLengthM,
  type DailyTarget,
  type DayActivity,
  type Sex,
} from "@/lib/calc";
import { sumTotals, type Totals } from "@/lib/meal/day";
import { exerciseContext, type ExerciseProfile } from "@/lib/workout/context";

/** Columnas del perfil que usa el balance. */
export interface BalanceProfile extends ExerciseProfile {
  stride_m: number | null;
  sedentary_steps_threshold: number;
}

/** Meta activa: peso objetivo y ritmo con signo (negativo = bajar). */
export interface BalanceGoal {
  target_weight_kg: number;
  weekly_rate_kg: number;
}

export interface MeasurementRow {
  measured_at: string;
  weight_kg: number;
  body_fat_pct: number | null;
}

export interface ScheduleRow {
  weekday: number;
  mode: string;
  level: string | null;
  custom_factor: number | null;
  steps_target: number | null;
}

export interface DailyActivityRow {
  day: string;
  mode: string;
  level: string | null;
  custom_factor: number | null;
  steps_actual: number | null;
}

export interface WorkoutRow {
  started_at: string;
  kcal_net: number;
}

export interface MealEntryRow {
  eaten_at: string;
  meal_item: { kcal: number; protein_g: number; carb_g: number; fat_g: number }[];
}

/** Todo lo que se necesita para calcular el balance de un rango de días. */
export interface BalanceData {
  profile: BalanceProfile;
  goal: BalanceGoal | null;
  /** Mediciones hasta el fin del rango (incluye la última anterior al inicio). */
  measurements: readonly MeasurementRow[];
  schedule: readonly ScheduleRow[];
  overrides: readonly DailyActivityRow[];
  workouts: readonly WorkoutRow[];
  meals: readonly MealEntryRow[];
}

/** Gasto del día (docs/03 §3): TDEE = TMB × factor + pasos extra + ejercicio neto. */
export interface DayEnergy {
  weightKg: number;
  bmr: number;
  factor: number;
  stepsKcal: number;
  exerciseNetKcal: number;
  tdee: number;
  activity: DayActivity;
}

export type BalanceStatus = "deficit" | "surplus" | "even";

export interface DayBalance {
  day: string;
  /** Ingesta del día: Σ kcal y macros de `meal_item`. */
  intake: Totals;
  /** Cantidad de ítems registrados; 0 = día sin registro de comidas. */
  itemCount: number;
  /** null si no hay peso registrado en o antes del día (no hay TMB). */
  energy: DayEnergy | null;
  /** ingesta − TDEE; negativo = déficit (docs/03 §6). */
  balanceKcal: number | null;
  status: BalanceStatus | null;
  /** Meta del día según el objetivo; null sin peso o sin meta activa. */
  target: DailyTarget | null;
  /** meta − ingesta; negativo = se pasó de la meta. */
  remainingKcal: number | null;
  /** Ingesta registrada bajo el mínimo prudente (solo si hay registro). */
  belowMinimum: boolean;
}

export interface WeekSummary {
  /** Lunes de la semana (ISO). */
  from: string;
  /** Último día incluido (domingo, o el día consultado si la semana no termina). */
  to: string;
  /** Días con comidas registradas y gasto calculable: los únicos que suman. */
  countedDays: number;
  /** Σ balance de los días contados; negativo = déficit. */
  balanceKcal: number;
  /** Déficit acumulado (= −balance); negativo = superávit acumulado. */
  deficitKcal: number;
  /** Σ (meta − TDEE) de los días contados: el déficit que pedía la meta. */
  targetDeficitKcal: number | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** `true` si es una fecha `YYYY-MM-DD` válida. */
export function isIsoDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertDay(day: string): void {
  if (!isIsoDay(day)) throw new RangeError(`Fecha inválida: ${day}`);
}

/** Suma `delta` días a una fecha `YYYY-MM-DD`. */
export function addDays(day: string, delta: number): string {
  assertDay(day);
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Lunes (ISO) de la semana de `day`. */
export function weekStart(day: string): string {
  assertDay(day);
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

/** Días de `from` a `to`, ambos incluidos. Lanza si `to` es anterior a `from`. */
export function daysBetween(from: string, to: string): string[] {
  assertDay(from);
  assertDay(to);
  const count = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
  if (count < 0) throw new RangeError("El fin del rango es anterior al inicio");
  return Array.from({ length: count + 1 }, (_, i) => addDays(from, i));
}

/**
 * Día calendario de un registro. Pesos, comidas y sesiones se guardan a mediodía
 * UTC del día elegido en la zona del perfil (`dayToTimestamp`), así que la fecha
 * UTC es la del usuario.
 */
export function rowDay(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** Último peso y último % de grasa medidos en o antes de `day`. */
export function bodyOn(
  day: string,
  measurements: readonly MeasurementRow[],
): { weightKg: number | null; bodyFatPct: number | null } {
  let weight: { at: string; value: number } | null = null;
  let fat: { at: string; value: number } | null = null;
  for (const m of measurements) {
    if (rowDay(m.measured_at) > day) continue;
    if (!weight || m.measured_at > weight.at)
      weight = { at: m.measured_at, value: m.weight_kg };
    if (m.body_fat_pct !== null && (!fat || m.measured_at > fat.at))
      fat = { at: m.measured_at, value: m.body_fat_pct };
  }
  return { weightKg: weight?.value ?? null, bodyFatPct: fat?.value ?? null };
}

/** Semana tipo (por día ISO) y ajustes por fecha como `DayActivity`. */
export function activityMaps(
  schedule: readonly ScheduleRow[],
  overrides: readonly DailyActivityRow[],
): {
  schedule: Record<number, DayActivity | undefined>;
  overrides: Record<string, DayActivity | undefined>;
} {
  const bySchedule: Record<number, DayActivity | undefined> = {};
  for (const row of schedule) {
    const activity = rowToActivity({ ...row, steps: row.steps_target });
    if (activity) bySchedule[row.weekday] = activity;
  }
  const byDay: Record<string, DayActivity | undefined> = {};
  for (const row of overrides) {
    const activity = rowToActivity({ ...row, steps: row.steps_actual });
    if (activity) byDay[row.day.slice(0, 10)] = activity;
  }
  return { schedule: bySchedule, overrides: byDay };
}

/** Ingesta (totales y cantidad de ítems) por día. */
export function intakeByDay(
  meals: readonly MealEntryRow[],
): Map<string, { totals: Totals; itemCount: number }> {
  const items = new Map<string, Totals[]>();
  for (const entry of meals) {
    const day = rowDay(entry.eaten_at);
    const list = items.get(day) ?? [];
    for (const item of entry.meal_item)
      list.push({
        kcal: item.kcal,
        proteinG: item.protein_g,
        carbG: item.carb_g,
        fatG: item.fat_g,
      });
    items.set(day, list);
  }
  const result = new Map<string, { totals: Totals; itemCount: number }>();
  for (const [day, list] of items)
    result.set(day, { totals: sumTotals(list), itemCount: list.length });
  return result;
}

/** Σ kcal netas de ejercicio por día (RF-12: netas, para no contar la TMB dos veces). */
export function exerciseByDay(workouts: readonly WorkoutRow[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const w of workouts) {
    const day = rowDay(w.started_at);
    result.set(day, (result.get(day) ?? 0) + Math.max(0, w.kcal_net));
  }
  return result;
}

const EMPTY_TOTALS: Totals = { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };

/**
 * Balance de cada día de `from` a `to` (docs/uml/actividad-balance-diario):
 * TMB con la fórmula del perfil y el peso vigente del día, actividad del día
 * (ajuste o semana tipo), ejercicio neto, ingesta, balance y meta.
 */
export function computeBalanceRange(
  from: string,
  to: string,
  data: BalanceData,
): DayBalance[] {
  const days = daysBetween(from, to);
  const { profile, goal } = data;
  const sex = profile.sex as Sex;
  const strideM = profile.stride_m ?? strideLengthM(profile.height_cm, sex);
  const activity = activityMaps(data.schedule, data.overrides);
  const intake = intakeByDay(data.meals);
  const exercise = exerciseByDay(data.workouts);

  return days.map((day): DayBalance => {
    const eaten = intake.get(day);
    const totals = eaten?.totals ?? EMPTY_TOTALS;
    const itemCount = eaten?.itemCount ?? 0;
    const belowMinimum = itemCount > 0 && isIntakeBelowMinimum(totals.kcal, sex);

    const body = bodyOn(day, data.measurements);
    const ctx = exerciseContext(profile, body.weightKg, body.bodyFatPct, day);
    if (!ctx)
      return {
        day,
        intake: totals,
        itemCount,
        energy: null,
        balanceKcal: null,
        status: null,
        target: null,
        remainingKcal: null,
        belowMinimum,
      };

    const dayActivity = resolveDayActivity(day, activity.schedule, activity.overrides);
    const breakdown = dayTdee({
      bmr: ctx.bmr,
      activity: dayActivity,
      weightKg: ctx.weightKg,
      strideM,
      thresholdSteps: profile.sedentary_steps_threshold,
      exerciseNetKcal: exercise.get(day) ?? 0,
    });
    const balanceKcal = dailyBalance(totals.kcal, breakdown.total);
    const target = goal
      ? dailyTargetKcal({
          tdeeKcal: breakdown.total,
          weeklyRateKg: goal.weekly_rate_kg,
          currentWeightKg: ctx.weightKg,
          targetWeightKg: goal.target_weight_kg,
          sex,
        })
      : null;
    return {
      day,
      intake: totals,
      itemCount,
      energy: {
        weightKg: ctx.weightKg,
        bmr: breakdown.bmr,
        factor: breakdown.factor,
        stepsKcal: breakdown.stepsKcal,
        exerciseNetKcal: breakdown.exerciseNetKcal,
        tdee: breakdown.total,
        activity: dayActivity,
      },
      balanceKcal,
      status: balanceStatus(balanceKcal),
      target,
      remainingKcal: (target?.kcal ?? breakdown.total) - totals.kcal,
      belowMinimum,
    };
  });
}

/** Déficit o superávit; «even» si la diferencia es menor a 1 kcal. */
export function balanceStatus(balanceKcal: number): BalanceStatus {
  if (Math.abs(balanceKcal) < 1) return "even";
  return balanceKcal < 0 ? "deficit" : "surplus";
}

/**
 * Acumulado de una semana (RF-27). Solo suma los días con comidas registradas y
 * gasto calculable: un día sin registro no es un déficit de todo el TDEE.
 */
export function weekSummary(days: readonly DayBalance[]): WeekSummary {
  if (days.length === 0) throw new RangeError("Se necesita al menos un día");
  let countedDays = 0;
  let balanceKcal = 0;
  let targetDeficitKcal: number | null = null;
  for (const d of days) {
    if (d.itemCount === 0 || d.balanceKcal === null || !d.energy) continue;
    countedDays += 1;
    balanceKcal += d.balanceKcal;
    if (d.target)
      targetDeficitKcal = (targetDeficitKcal ?? 0) + d.energy.tdee - d.target.kcal;
  }
  return {
    from: days[0].day,
    to: days[days.length - 1].day,
    countedDays,
    balanceKcal,
    deficitKcal: 0 - balanceKcal,
    targetDeficitKcal,
  };
}
