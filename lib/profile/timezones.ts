/** Zonas horarias IANA disponibles en el runtime (con respaldo si no hay soporte). */
export function listTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [
      "America/Santiago",
      "America/Argentina/Buenos_Aires",
      "America/Lima",
      "America/Bogota",
      "America/Mexico_City",
      "Europe/Madrid",
      "UTC",
    ];
  }
}
