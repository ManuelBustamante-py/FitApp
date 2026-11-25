import "server-only";

import { headers } from "next/headers";

import { createClient } from "@/lib/db/server";

import { resolveUserCountry } from "./country";

/** País de la IP según Vercel (cabecera x-vercel-ip-country); null fuera de Vercel. */
export async function getIpCountry(): Promise<string | null> {
  const list = await headers();
  return list.get("x-vercel-ip-country");
}

/**
 * País con el que se ordenan los productos, a partir del país del perfil ya leído: el
 * del perfil, si no la IP (si es de LatAm), si no Chile. Solo lee la cabecera si hace falta.
 */
export async function userCountryFrom(profileCountry: string | null): Promise<string> {
  return resolveUserCountry({
    profileCountry,
    ipCountry: profileCountry ? null : await getIpCountry(),
  });
}

/** País con el que se ordenan los productos para el usuario (lee profile.country). */
export async function getUserCountry(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("country")
    .eq("user_id", userId)
    .maybeSingle();
  return userCountryFrom(data?.country ?? null);
}
