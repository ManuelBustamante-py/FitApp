import "server-only";

import { createClient } from "@/lib/db/server";
import { dayRange } from "@/lib/weight/entries";

import {
  computeBalanceRange,
  daysBetween,
  weekStart,
  weekSummary,
  type BalanceData,
  type DayBalance,
  type WeekSummary,
} from "./compute";

/** Rango máximo que se lee de una vez (≈ un trimestre, para gráficos de #22). */
export const MAX_RANGE_DAYS = 92;

/**
 * Lee, con la RLS del usuario, todo lo que necesita el balance de `from` a `to`
 * (fechas `YYYY-MM-DD` en la zona del perfil). null si no hay perfil.
 */
export async function getBalanceData(
  userId: string,
  from: string,
  to: string,
): Promise<BalanceData | null> {
  if (daysBetween(from, to).length > MAX_RANGE_DAYS)
    throw new RangeError(`El rango supera ${MAX_RANGE_DAYS} días`);
  const start = dayRange(from).from;
  const end = dayRange(to).to;
  const supabase = await createClient();
  const measurementCols = "measured_at, weight_kg, body_fat_pct";
  const [
    profile,
    goal,
    inRange,
    weightBefore,
    fatBefore,
    schedule,
    overrides,
    workouts,
    meals,
  ] = await Promise.all([
    supabase
      .from("profile")
      .select(
        "sex, birth_date, height_cm, bmr_formula, bmr_measured_kcal, stride_m, sedentary_steps_threshold",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("goal")
      .select("target_weight_kg, weekly_rate_kg")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("body_measurement")
      .select(measurementCols)
      .eq("user_id", userId)
      .gte("measured_at", start)
      .lt("measured_at", end),
    supabase
      .from("body_measurement")
      .select(measurementCols)
      .eq("user_id", userId)
      .lt("measured_at", start)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_measurement")
      .select(measurementCols)
      .eq("user_id", userId)
      .lt("measured_at", start)
      .not("body_fat_pct", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("activity_schedule")
      .select("weekday, mode, level, custom_factor, steps_target")
      .eq("user_id", userId),
    supabase
      .from("daily_activity")
      .select("day, mode, level, custom_factor, steps_actual")
      .eq("user_id", userId)
      .gte("day", from)
      .lte("day", to),
    supabase
      .from("workout_session")
      .select("started_at, kcal_net")
      .eq("user_id", userId)
      .gte("started_at", start)
      .lt("started_at", end),
    supabase
      .from("meal_entry")
      .select("eaten_at, meal_item (kcal, protein_g, carb_g, fat_g)")
      .eq("user_id", userId)
      .gte("eaten_at", start)
      .lt("eaten_at", end),
  ]);
  if (
    profile.error ||
    goal.error ||
    inRange.error ||
    weightBefore.error ||
    fatBefore.error ||
    schedule.error ||
    overrides.error ||
    workouts.error ||
    meals.error
  )
    throw new Error("No se pudo calcular tu balance.");
  if (!profile.data) return null;

  const measurements = [...inRange.data];
  if (weightBefore.data) measurements.push(weightBefore.data);
  if (fatBefore.data) measurements.push(fatBefore.data);

  return {
    profile: profile.data,
    goal: goal.data ?? null,
    measurements,
    schedule: schedule.data,
    overrides: overrides.data,
    workouts: workouts.data,
    meals: meals.data,
  };
}

/** Balance de cada día de un rango (para el panel #21 y los gráficos #22). */
export async function getBalanceRange(
  userId: string,
  from: string,
  to: string,
): Promise<DayBalance[] | null> {
  const data = await getBalanceData(userId, from, to);
  return data ? computeBalanceRange(from, to, data) : null;
}

export interface DayBalanceView {
  /** Balance del día consultado. */
  day: DayBalance;
  /** Días de la semana (lunes → día consultado). */
  weekDays: DayBalance[];
  /** Déficit acumulado de la semana hasta el día consultado. */
  week: WeekSummary;
}

/** Balance de `day` y el acumulado de su semana (lunes a `day`). */
export async function getDayBalance(
  userId: string,
  day: string,
): Promise<DayBalanceView | null> {
  const from = weekStart(day);
  const weekDays = await getBalanceRange(userId, from, day);
  if (!weekDays) return null;
  return {
    day: weekDays[weekDays.length - 1],
    weekDays,
    week: weekSummary(weekDays),
  };
}
