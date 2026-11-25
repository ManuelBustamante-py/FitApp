"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMagicLink } from "@/lib/auth/magic-link";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export type PasteLinkState = { status: "idle" } | { status: "error"; message: string };

const emailSchema = z.email("Ingresa un email válido.");

/**
 * Cliente solo para pedir el enlace, con flujo implícito: no guarda un
 * code_verifier en cookies, así el enlace funciona aunque se abra en otro
 * navegador o en la app de correo (el flujo PKCE de @supabase/ssr lo exige).
 * La plantilla por defecto de Supabase no se puede editar sin SMTP propio.
 */
function createOtpSender() {
  return createSupabaseClient(
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

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Email inválido.",
    };
  }

  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const origin = (await headers()).get("origin");
  if (!origin) {
    return {
      status: "error",
      message: "No se pudo determinar el origen de la petición.",
    };
  }

  const { error } = await createOtpSender().auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Demasiados intentos. Espera unos minutos y vuelve a probar."
        : "No se pudo enviar el enlace. Inténtalo de nuevo.";
    return { status: "error", message };
  }

  return { status: "sent", email: parsed.data };
}

/**
 * Inicia sesión con el enlace del correo pegado en la app, sin abrirlo.
 * Sirve cuando el correo abre el enlace en otro navegador y en la PWA instalada.
 */
export async function verifyPastedLink(
  _prev: PasteLinkState,
  formData: FormData,
): Promise<PasteLinkState> {
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const link = parseMagicLink(
    String(formData.get("link") ?? ""),
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (!link) {
    return {
      status: "error",
      message: "Eso no parece el enlace del correo de FitApp. Cópialo completo.",
    };
  }
  if (link.tokenHash.startsWith("pkce_")) {
    return {
      status: "error",
      message: "Ese enlace es de un formato antiguo. Pide uno nuevo.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: link.tokenHash,
    type: link.type,
  });
  if (error) {
    return {
      status: "error",
      message:
        "El enlace ya se usó o venció (cada enlace sirve una sola vez). Pide uno nuevo.",
    };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
