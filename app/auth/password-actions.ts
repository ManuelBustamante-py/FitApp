"use server";

import { redirect } from "next/navigation";

import { callbackUrl, createOtpSender, requestOrigin } from "@/lib/auth/otp-sender";
import {
  credentialsSchema,
  emailSchema,
  firstIssue,
  newPasswordSchema,
  passwordAuthMessage,
  signUpSchema,
} from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/server";

export type PasswordFormState =
  | { status: "idle" }
  | { status: "info"; message: string }
  | { status: "error"; message: string };

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

/** Entrar con email y contraseña. */
export async function signInWithPassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = credentialsSchema.safeParse(credentials(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: passwordAuthMessage(error, "entrar") };

  redirect(safeNextPath(String(formData.get("next") ?? "/")));
}

/**
 * Crear cuenta. Con «Confirm email» desactivado en Supabase la sesión queda
 * iniciada al instante; si está activo, se pide confirmar con el enlace del correo.
 */
export async function signUpWithPassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = signUpSchema.safeParse(credentials(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const origin = await requestOrigin();
  if (!origin) {
    return {
      status: "error",
      message: "No se pudo determinar el origen de la petición.",
    };
  }

  // Flujo implícito: si hay correo de confirmación, su enlace sirve en cualquier navegador.
  const { data, error } = await createOtpSender().auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: callbackUrl(origin, next) },
  });
  if (error) return { status: "error", message: passwordAuthMessage(error, "registro") };

  if (!data.session) {
    return {
      status: "info",
      message:
        "Te enviamos un enlace para confirmar tu email. Ábrelo (o pégalo abajo) para terminar.",
    };
  }

  // Guarda en cookies la sesión que devolvió el registro.
  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) {
    return { status: "info", message: "Cuenta creada. Entra con tu email y contraseña." };
  }

  redirect(next);
}

/** Enviar el enlace para elegir una contraseña nueva. No revela si el email existe. */
export async function requestPasswordReset(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return {
      status: "error",
      message: "Escribe tu email arriba para recuperar la contraseña.",
    };
  }
  const origin = await requestOrigin();
  if (!origin) {
    return {
      status: "error",
      message: "No se pudo determinar el origen de la petición.",
    };
  }

  const { error } = await createOtpSender().auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callbackUrl(origin, "/cuenta/contrasena"),
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { status: "error", message: passwordAuthMessage(error, "entrar") };
  }

  return {
    status: "info",
    message: `Si ${parsed.data} tiene cuenta, te enviamos un enlace para elegir una contraseña nueva. Ábrelo una sola vez (o pégalo abajo).`,
  };
}

/** Definir o cambiar la contraseña del usuario con sesión iniciada. */
export async function updatePassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: passwordAuthMessage(error, "cambio") };

  return {
    status: "info",
    message: "Contraseña guardada. Ya puedes entrar con tu email y contraseña.",
  };
}
