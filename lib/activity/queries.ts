import "server-only";

import { createClient } from "@/lib/db/server";

/** Todo lo que necesita la pantalla de actividad y TMB. */
export async function getActivityData(userId: string, fromDay: string) {
  const supabase = await createClient();
  const [schedule, overrides, weight, bodyFat] = await Promise.all([
    supabase
      .from("activity_schedule")
      .select("weekday, mode, level, custom_factor, steps_target")
      .eq("user_id", userId),
    supabase
      .from("daily_activity")
      .select("day, mode, level, custom_factor, steps_actual")
      .eq("user_id", userId)
      .gte("day", fromDay)
      .order("day", { ascending: true })
      .limit(60),
    supabase
      .from("body_measurement")
      .select("weight_kg")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_measurement")
      .select("body_fat_pct")
      .eq("user_id", userId)
      .not("body_fat_pct", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (schedule.error || overrides.error || weight.error || bodyFat.error)
    throw new Error("No se pudo leer la actividad.");
  return {
    schedule: schedule.data,
    overrides: overrides.data,
    weightKg: weight.data?.weight_kg ?? null,
    bodyFatPct: bodyFat.data?.body_fat_pct ?? null,
  };
}

/** % de grasa más reciente del usuario (para validar fórmulas que lo piden). */
export async function getLatestBodyFat(userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurement")
    .select("body_fat_pct")
    .eq("user_id", userId)
    .not("body_fat_pct", "is", null)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el % de grasa.");
  return data?.body_fat_pct ?? null;
}
