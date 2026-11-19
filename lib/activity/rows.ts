import type { ActivityLevel, DayActivity } from "@/lib/calc";

import { ACTIVITY_CHOICES } from "./schema";

const LEVELS = ACTIVITY_CHOICES.filter((c) => c.value !== "steps").map(
  (c) => c.value,
) as readonly string[];

/** Fila de `activity_schedule` o `daily_activity` → `DayActivity` (null si es inconsistente). */
export function rowToActivity(row: {
  mode: string;
  level: string | null;
  custom_factor: number | null;
  steps: number | null;
}): DayActivity | null {
  if (row.mode === "steps")
    return row.steps === null ? null : { mode: "steps", steps: row.steps };
  if (row.mode !== "level" || !row.level || !LEVELS.includes(row.level)) return null;
  if (row.level === "custom" && row.custom_factor === null) return null;
  return {
    mode: "level",
    level: row.level as ActivityLevel,
    customFactor: row.custom_factor,
  };
}

/** `DayActivity` → valores para el selector (`kind`) y el campo numérico (`value`). */
export function activityToField(activity: DayActivity): { kind: string; value: string } {
  if (activity.mode === "steps") return { kind: "steps", value: String(activity.steps) };
  return {
    kind: activity.level,
    value: activity.level === "custom" ? String(activity.customFactor ?? "") : "",
  };
}

/** Texto corto de una actividad para listas. */
export function describeActivity(activity: DayActivity): string {
  if (activity.mode === "steps") return `${activity.steps.toLocaleString("es")} pasos`;
  if (activity.level === "custom")
    return `Personalizado (${String(activity.customFactor).replace(".", ",")})`;
  return (
    ACTIVITY_CHOICES.find((c) => c.value === activity.level)?.label ?? activity.level
  );
}
