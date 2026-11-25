"use server";

import { redirect } from "next/navigation";

import { parseMagicLink } from "@/lib/auth/magic-link";
import { callbackUrl, createOtpSender, requestOrigin } from "@/lib/auth/otp-sender";
import { emailSchema } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export type PasteLinkState = { status: "idle" } | { status: "error"; message: string };

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
  const origin = await requestOrigin();
  if (!origin) {
    return {
      status: "error",
      message: "No se pudo determinar el origen de la petición.",
    };
  }

  const { error } = await createOtpSender().auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: callbackUrl(origin, next),
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

  // Un enlace de recuperación lleva a elegir la contraseña nueva.
  redirect(
    link.type === "recovery"
      ? "/cuenta/contrasena"
      : safeNextPath(String(formData.get("next") ?? "/")),
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Guarda en cookies, desde el servidor, la sesión que trae el enlace mágico
 * (flujo implícito, tokens en el fragmento de /auth/callback). Así la sesión se
 * escribe igual que en el login con contraseña, con Set-Cookie del servidor, y
 * no desde el navegador con document.cookie.
 */
export async function establishSession(
  accessToken: string,
  refreshToken: string,
): Promise<{ ok: boolean }> {
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return { ok: false };
  }
  if (
    !accessToken ||
    !refreshToken ||
    accessToken.length > 8192 ||
    refreshToken.length > 512
  ) {
    return { ok: false };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { ok: !error };
}
