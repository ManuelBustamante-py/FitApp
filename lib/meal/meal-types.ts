/** Tipos de comida (mismo CHECK que `meal_entry.meal_type`), en orden del día. */
export const MEAL_TYPES = ["desayuno", "almuerzo", "once", "cena", "colacion"] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  once: "Once",
  cena: "Cena",
  colacion: "Colación",
};

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as readonly string[]).includes(value);
}

/**
 * Comida sugerida según la hora local (0–23), con los horarios habituales en Chile:
 * desayuno 5–10, colación 11, almuerzo 12–15, once 16–19, cena 20–23 y colación de
 * madrugada (0–4).
 */
export function defaultMealType(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "desayuno";
  if (hour >= 12 && hour < 16) return "almuerzo";
  if (hour >= 16 && hour < 20) return "once";
  if (hour >= 20 && hour < 24) return "cena";
  return "colacion";
}

/** Hora actual (0–23) en una zona horaria IANA; UTC si la zona no es válida. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  try {
    const text = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now);
    return Number(text) % 24;
  } catch {
    return now.getUTCHours();
  }
}
