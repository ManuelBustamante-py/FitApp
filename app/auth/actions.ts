"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const emailSchema = z.email("Ingresa un email válido.");

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
