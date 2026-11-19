/**
 * Normaliza el parámetro `next` para evitar redirecciones abiertas:
 * solo se aceptan rutas internas ("/algo"), nunca "//dominio" ni URLs absolutas.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
