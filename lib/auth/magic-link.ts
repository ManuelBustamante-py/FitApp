import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite"];

/**
 * Extrae el token de un enlace del correo de Supabase
 * (`https://<ref>.supabase.co/auth/v1/verify?token=…&type=…`) sin abrirlo.
 * El `token` de ese enlace es el hash del token, el mismo que espera
 * `verifyOtp({ token_hash })`. Solo acepta enlaces del proyecto propio.
 */
export function parseMagicLink(
  raw: string,
  supabaseUrl: string,
): { tokenHash: string; type: EmailOtpType } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.origin !== new URL(supabaseUrl).origin || url.pathname !== "/auth/v1/verify") {
    return null;
  }

  const tokenHash = url.searchParams.get("token");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !OTP_TYPES.includes(type)) return null;
  return { tokenHash, type };
}

/** Mensaje para el código de error que Supabase deja en el fragmento (#error_code=…). */
export function magicLinkErrorMessage(code: string | null): string {
  switch (code) {
    case "otp_expired":
      return "El enlace ya se usó o venció (cada enlace sirve una sola vez). Pide uno nuevo y ábrelo una sola vez.";
    case "otro_navegador":
      return "Ese enlace se pidió desde otro navegador. Pide uno nuevo.";
    default:
      return "El enlace no es válido o ya venció. Pide uno nuevo.";
  }
}
