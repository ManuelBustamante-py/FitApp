import "server-only";

import { createClient } from "@/lib/db/server";

import { cleanQuery, DEFAULT_RESULTS, isSearchable } from "./search";

export type FoodSearchResult = {
  id: string;
  name_es: string;
  name_en: string | null;
  brand: string | null;
  category: string | null;
  source: string;
  basis: string;
  barcode: string | null;
  owner_user_id: string | null;
  kcal_per_100: number | null;
  score: number;
};

/** Busca alimentos visibles para el usuario (RPC `search_food`, respeta la RLS). */
export async function searchFoods(
  raw: string,
  maxResults = DEFAULT_RESULTS,
): Promise<FoodSearchResult[]> {
  const q = cleanQuery(raw);
  if (!isSearchable(q)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_food", {
    q,
    max_results: maxResults,
  });
  if (error) throw new Error("No se pudo buscar alimentos.");
  return data;
}
