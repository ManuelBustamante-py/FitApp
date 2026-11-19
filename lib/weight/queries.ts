import "server-only";

import { createClient } from "@/lib/db/server";

const HISTORY_LIMIT = 200;

/** Historial de pesos, del más reciente al más antiguo. */
export async function listWeights(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurement")
    .select("id, measured_at, weight_kg")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error("No se pudo leer el historial de peso.");
  return data;
}
