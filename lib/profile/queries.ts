import "server-only";

import { createClient } from "@/lib/db/server";

import { dominantLevel } from "./level";
import { ONBOARDING_ACTIVITY_LEVELS } from "./schema";

export async function getProfileBundle(userId: string) {
  const supabase = await createClient();
  const [profile, goal, schedule] = await Promise.all([
    supabase.from("profile").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("goal")
      .select("target_weight_kg, target_bmi, weekly_rate_kg")
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("activity_schedule")
      .select("weekday, mode, level")
      .eq("user_id", userId),
  ]);
  if (profile.error) throw new Error("No se pudo leer el perfil.");
  if (!profile.data) return null;
  const level = dominantLevel(schedule.data ?? []);
  return {
    profile: profile.data,
    goal: goal.data ?? null,
    level: (ONBOARDING_ACTIVITY_LEVELS as readonly string[]).includes(level ?? "")
      ? (level as string)
      : "sedentary",
    scheduleRows: schedule.data?.length ?? 0,
  };
}
