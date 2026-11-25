import { z } from "zod";

export const PASSWORD_MIN = 8;
/** bcrypt (usado por Supabase Auth) ignora lo que pasa de 72 bytes. */
export const PASSWORD_MAX = 72;

export const emailSchema = z.email("Ingresa un email válido.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .refine(
    (p) => new TextEncoder().encode(p).length <= PASSWORD_MAX,
    `La contraseña puede tener como máximo ${PASSWORD_MAX} caracteres.`,
  );

export const credentialsSchema = z.object({
  email: z.string().trim().pipe(emailSchema),
  // Al entrar no se valida el largo: solo se compara con la guardada.
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export const signUpSchema = z.object({
  email: z.string().trim().pipe(emailSchema),
  password: passwordSchema,
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

/** Primer mensaje de error de una validación de zod. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

type AuthErrorLike = { code?: string | null; status?: number | null };

/**
 * Traduce errores de Supabase Auth a mensajes en español. No revela si un email
 * está registrado: credenciales incorrectas y email inexistente dan el mismo mensaje.
 */
export function passwordAuthMessage(
  error: AuthErrorLike,
  action: "entrar" | "registro" | "cambio",
): string {
  if (error.status === 429 || error.code?.startsWith("over_")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Primero confirma tu email con el enlace que te enviamos.";
    case "weak_password":
      return "Esa contraseña es muy débil o aparece en filtraciones conocidas. Elige otra.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la actual.";
    case "user_already_exists":
    case "email_exists":
      return "No se pudo crear la cuenta con ese email. Si ya tienes una, entra con tu contraseña o pide un enlace.";
    case "reauthentication_needed":
    case "session_not_found":
      return "Tu sesión expiró. Entra de nuevo y vuelve a intentarlo.";
  }
  if (action === "entrar") return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  if (action === "registro") return "No se pudo crear la cuenta. Inténtalo de nuevo.";
  return "No se pudo cambiar la contraseña. Inténtalo de nuevo.";
}
