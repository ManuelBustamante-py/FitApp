import "server-only";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Cliente sin sesión con flujo implícito, para operaciones que envían correos
 * (enlace mágico, registro, recuperación). No guarda un code_verifier en cookies,
 * así el enlace funciona aunque se abra en otro navegador o en la app de correo
 * (el flujo PKCE de @supabase/ssr lo exige). La plantilla por defecto de Supabase
 * no se puede editar sin SMTP propio.
 */
export function createOtpSender() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

/** Origen de la petición actual (para armar los enlaces de los correos), o null. */
export async function requestOrigin(): Promise<string | null> {
  return (await headers()).get("origin");
}

/** URL de destino de los enlaces de correo, que lleva a `next` tras iniciar sesión. */
export function callbackUrl(origin: string, next: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
