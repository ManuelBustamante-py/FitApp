import "server-only";

import { createClient } from "@/lib/db/server";

const RECENT_LIMIT = 20;

/** Último peso y % de grasa del usuario (para las estimaciones y la TMB). */
export async function getBodyData(userId: string) {
  const supabase = await createClient();
  const [weight, bodyFat] = await Promise.all([
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
  if (weight.error || bodyFat.error) throw new Error("No se pudo leer tu peso.");
  return {
    weightKg: weight.data?.weight_kg ?? null,
    bodyFatPct: bodyFat.data?.body_fat_pct ?? null,
  };
}

/** Catálogo de actividades (solo lectura para todos los usuarios). */
export async function listActivityTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_type")
    .select("id, name_es, met, category")
    .order("category")
    .order("id");
  if (error) throw new Error("No se pudo leer el catálogo de actividades.");
  return data;
}

/** Sesiones recientes del usuario, de la más nueva a la más antigua. */
export async function listRecentWorkouts(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_session")
    .select(
      "id, activity_type_id, started_at, duration_min, machine_kcal, hr_avg, kcal_hr, kcal_met, kcal_selected, kcal_method, kcal_net, activity_type (name_es)",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw new Error("No se pudieron leer tus sesiones.");
  return data;
}

/** Plantillas de sesión del usuario (RF-13), de la más nueva a la más antigua. */
export async function listTemplates(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_template")
    .select("id, name, activity_type_id, duration_min, activity_type (name_es)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron leer tus plantillas.");
  return data;
}
