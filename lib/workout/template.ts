import { toNumber } from "@/lib/activity/schema";

import { DURATION_RANGE_MIN } from "./schema";

export const TEMPLATE_NAME_MAX = 80;

export type TemplateField = "name" | "activityTypeId" | "durationMin";
export type TemplateFieldErrors = Partial<Record<TemplateField, string>>;

export interface TemplateValues {
  name: string;
  activityTypeId: number;
  durationMin: number;
}

export type TemplateParseResult =
  | { success: true; data: TemplateValues }
  | { success: false; errors: TemplateFieldErrors };

/** Nombre sugerido para una plantilla: «Spinning 20 min» (coma decimal, máx. 80). */
export function defaultTemplateName(activityName: string, durationMin: number): string {
  const minutes = String(Math.round(durationMin * 10) / 10).replace(".", ",");
  return `${activityName} ${minutes} min`.slice(0, TEMPLATE_NAME_MAX).trim();
}

/**
 * Valida una plantilla de sesión (RF-13). Si `fallbackName` se entrega y el nombre
 * viene vacío, se usa el nombre que devuelva en su lugar.
 */
export function parseTemplateForm(
  input: FormData | Record<string, unknown>,
  fallbackName?: (values: { activityTypeId: number; durationMin: number }) => string,
): TemplateParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const errors: TemplateFieldErrors = {};

  const activity = toNumber(get("activityTypeId"));
  if (activity === null || !Number.isInteger(activity) || activity <= 0)
    errors.activityTypeId = "Elige una actividad.";

  const duration = toNumber(get("durationMin"));
  const rounded = duration === null ? null : Math.round(duration * 10) / 10;
  if (
    duration === null ||
    rounded === null ||
    !Number.isFinite(duration) ||
    rounded < DURATION_RANGE_MIN.min ||
    duration > DURATION_RANGE_MIN.max
  )
    errors.durationMin = "Ingresa la duración en minutos (entre 0,1 y 1.440).";

  const raw = get("name");
  let name = typeof raw === "string" ? raw.trim() : "";
  if (name === "" && fallbackName && !errors.activityTypeId && !errors.durationMin)
    name = fallbackName({
      activityTypeId: activity as number,
      durationMin: rounded as number,
    });
  if (name === "") errors.name = "Ponle un nombre a la plantilla.";
  else if (name.length > TEMPLATE_NAME_MAX)
    errors.name = `El nombre puede tener hasta ${TEMPLATE_NAME_MAX} caracteres.`;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: { name, activityTypeId: activity as number, durationMin: rounded as number },
  };
}
