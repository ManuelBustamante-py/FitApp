import "server-only";

import { createClient } from "@/lib/db/server";

import { barcodeCandidates, isValidBarcode } from "./barcode";
import { sourceRank } from "./search";

/**
 * Busca el alimento de un código de barras ya validado (RF-23). Respeta la RLS: ve los
 * alimentos globales (Open Food Facts incluido) y los propios. Si hay varios, gana el
 * propio y luego el de mayor prioridad de fuente.
 */
export async function findFoodByBarcode(
  raw: string,
  userId: string,
): Promise<string | null> {
  if (!isValidBarcode(raw)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food")
    .select("id, source, owner_user_id")
    .in("barcode", barcodeCandidates(raw))
    .limit(20);
  if (error) throw new Error("No se pudo buscar el código de barras.");
  const best = [...data].sort(
    (a, b) =>
      sourceRank(a.source, a.owner_user_id === userId) -
      sourceRank(b.source, b.owner_user_id === userId),
  )[0];
  return best?.id ?? null;
}
