import "server-only";

import { addDays } from "@/lib/balance/compute";
import { createClient } from "@/lib/db/server";
import { dayRange } from "@/lib/weight/entries";

import { MOVING_AVERAGE_DAYS, type WeightRow } from "./series";

/** Pesos de `from` a `to` más los días previos que necesita el promedio móvil. */
export async function listWeightsInRange(
  userId: string,
  from: string,
  to: string,
): Promise<WeightRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurement")
    .select("measured_at, weight_kg")
    .eq("user_id", userId)
    .gte("measured_at", dayRange(addDays(from, -(MOVING_AVERAGE_DAYS - 1))).from)
    .lt("measured_at", dayRange(to).to)
    .order("measured_at", { ascending: true });
  if (error) throw new Error("No se pudo leer el historial de peso.");
  return data;
}
