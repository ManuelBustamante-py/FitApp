/**
 * País del usuario para priorizar productos (tarea #41). Lógica pura, sin acceso a datos.
 *
 * Códigos ISO 3166-1 alfa-2 en mayúsculas, los mismos que guarda food.countries (ETL de
 * Open Food Facts) y profile.country.
 */

export const DEFAULT_COUNTRY = "CL";

/** Países de LatAm que se ofrecen en el perfil, con su nombre en español. */
export const LATAM_COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "DO", name: "República Dominicana" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
] as const;

export type LatamCountryCode = (typeof LATAM_COUNTRIES)[number]["code"];

export const LATAM_COUNTRY_CODES = LATAM_COUNTRIES.map((c) => c.code) as [
  LatamCountryCode,
  ...LatamCountryCode[],
];

const NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  LATAM_COUNTRIES.map((c) => [c.code, c.name]),
);

/** Normaliza un código de país (mayúsculas, sin espacios); null si no son 2 letras. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** true si el código (ya normalizado) es de un país de la lista LatAm. */
export function isLatamCountry(
  code: string | null | undefined,
): code is LatamCountryCode {
  return !!code && Object.hasOwn(NAMES, code);
}

/** Nombre en español del país; el código si no está en la lista. */
export function countryName(code: string): string {
  return NAMES[code] ?? code;
}

/** "México", "México y Perú", "Argentina, México y Perú". */
export function countryList(codes: readonly string[]): string {
  const names = codes.map(countryName);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Zonas horarias IANA de LatAm → país (para proponer el país sin IP). */
const TIMEZONE_COUNTRY: Readonly<Record<string, LatamCountryCode>> = {
  "America/Santiago": "CL",
  "America/Punta_Arenas": "CL",
  "Pacific/Easter": "CL",
  "America/Buenos_Aires": "AR",
  "America/Cordoba": "AR",
  "America/Mendoza": "AR",
  "America/La_Paz": "BO",
  "America/Bogota": "CO",
  "America/Costa_Rica": "CR",
  "America/Havana": "CU",
  "America/Santo_Domingo": "DO",
  "America/Guayaquil": "EC",
  "Pacific/Galapagos": "EC",
  "America/El_Salvador": "SV",
  "America/Guatemala": "GT",
  "America/Tegucigalpa": "HN",
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Merida": "MX",
  "America/Monterrey": "MX",
  "America/Matamoros": "MX",
  "America/Chihuahua": "MX",
  "America/Ciudad_Juarez": "MX",
  "America/Ojinaga": "MX",
  "America/Mazatlan": "MX",
  "America/Bahia_Banderas": "MX",
  "America/Hermosillo": "MX",
  "America/Tijuana": "MX",
  "America/Managua": "NI",
  "America/Panama": "PA",
  "America/Asuncion": "PY",
  "America/Lima": "PE",
  "America/Montevideo": "UY",
  "America/Caracas": "VE",
  "America/Sao_Paulo": "BR",
  "America/Manaus": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Belem": "BR",
  "America/Bahia": "BR",
  "America/Maceio": "BR",
  "America/Araguaina": "BR",
  "America/Santarem": "BR",
  "America/Cuiaba": "BR",
  "America/Campo_Grande": "BR",
  "America/Porto_Velho": "BR",
  "America/Boa_Vista": "BR",
  "America/Rio_Branco": "BR",
  "America/Eirunepe": "BR",
  "America/Noronha": "BR",
};

/** País LatAm de una zona horaria IANA; null si no es de LatAm. */
export function countryFromTimeZone(
  timezone: string | null | undefined,
): LatamCountryCode | null {
  if (!timezone) return null;
  if (timezone.startsWith("America/Argentina/")) return "AR";
  return TIMEZONE_COUNTRY[timezone] ?? null;
}

/**
 * País propuesto para el formulario de perfil cuando aún no hay uno guardado:
 * el de la IP (si es LatAm), si no el de la zona horaria, si no Chile.
 */
export function proposeCountry(input: {
  ipCountry?: string | null;
  timezone?: string | null;
}): LatamCountryCode {
  const ip = normalizeCountry(input.ipCountry);
  if (isLatamCountry(ip)) return ip;
  return countryFromTimeZone(input.timezone) ?? DEFAULT_COUNTRY;
}

/**
 * País con el que se ordenan los productos: el del perfil; si no hay, el de la IP
 * (cabecera x-vercel-ip-country) cuando es de LatAm; si no, Chile.
 */
export function resolveUserCountry(input: {
  profileCountry?: string | null;
  ipCountry?: string | null;
}): string {
  const profile = normalizeCountry(input.profileCountry);
  if (profile) return profile;
  const ip = normalizeCountry(input.ipCountry);
  if (isLatamCountry(ip)) return ip;
  return DEFAULT_COUNTRY;
}

/** true si el producto es de otro país (tiene países y ninguno es el del usuario). */
export function isForeignProduct(
  countries: readonly string[] | null | undefined,
  userCountry: string,
): boolean {
  return !!countries && countries.length > 0 && !countries.includes(userCountry);
}
