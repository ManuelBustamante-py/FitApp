import { z } from "zod";

import { ageOn, weightForBmi } from "@/lib/calc";

export const SEXES = ["male", "female"] as const;
export const ONBOARDING_ACTIVITY_LEVELS = [
  "bmr_only",
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export const GOAL_TYPES = ["weight", "bmi"] as const;
export const GOAL_DIRECTIONS = ["lose", "gain"] as const;

export const MIN_AGE = 14;
export const MAX_AGE = 110;
export const HEIGHT_RANGE_CM = { min: 100, max: 230 } as const;
export const WEEKLY_RATE_RANGE_KG = { min: 0.25, max: 1 } as const;
/** Límites del CHECK de `goal.target_weight_kg` y `goal.target_bmi`. */
export const TARGET_WEIGHT_RANGE_KG = { min: 30, max: 300 } as const;
export const TARGET_BMI_RANGE = { min: 15, max: 40 } as const;

export const ACTIVITY_LEVEL_LABELS: Record<
  (typeof ONBOARDING_ACTIVITY_LEVELS)[number],
  { label: string; hint: string }
> = {
  bmr_only: { label: "Solo TMB", hint: "Sin actividad cotidiana (factor 1,0)" },
  sedentary: { label: "Sedentario", hint: "Poco o nada de movimiento (1,2)" },
  light: { label: "Ligero", hint: "Ejercicio 1–3 días a la semana (1,375)" },
  moderate: { label: "Moderado", hint: "Ejercicio 3–5 días a la semana (1,55)" },
  active: { label: "Activo", hint: "Ejercicio 6–7 días a la semana (1,725)" },
  very_active: {
    label: "Muy activo",
    hint: "Trabajo físico o doble entrenamiento (1,9)",
  },
};

/** Convierte el texto de un campo en número (acepta coma decimal); vacío → undefined. */
function toNumber(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (text === "") return undefined;
  return Number(text.replace(",", "."));
}

const numberField = (message: string) =>
  z.preprocess(toNumber, z.number({ error: message }).finite(message));

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("es", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const profileFormSchema = z
  .object({
    sex: z.enum(SEXES, { error: "Elige una opción." }),
    birthDate: z
      .string({ error: "Ingresa tu fecha de nacimiento." })
      .refine(isValidIsoDate, "Ingresa una fecha válida."),
    heightCm: numberField("Ingresa tu estatura en cm.").pipe(
      z
        .number()
        .min(
          HEIGHT_RANGE_CM.min,
          `La estatura debe ser de al menos ${HEIGHT_RANGE_CM.min} cm.`,
        )
        .max(
          HEIGHT_RANGE_CM.max,
          `La estatura debe ser de como máximo ${HEIGHT_RANGE_CM.max} cm.`,
        ),
    ),
    activityLevel: z.enum(ONBOARDING_ACTIVITY_LEVELS, { error: "Elige un nivel." }),
    timezone: z
      .string({ error: "Elige tu zona horaria." })
      .refine(isValidTimeZone, "Zona horaria no válida."),
    goalType: z.enum(GOAL_TYPES, { error: "Elige un tipo de meta." }),
    targetWeightKg: z.preprocess(toNumber, z.number().finite().optional()),
    targetBmi: z.preprocess(toNumber, z.number().finite().optional()),
    goalDirection: z.enum(GOAL_DIRECTIONS, { error: "Elige una dirección." }),
    weeklyRateKg: numberField("Ingresa el ritmo semanal en kg.").pipe(
      z
        .number()
        .min(WEEKLY_RATE_RANGE_KG.min, "El ritmo mínimo es 0,25 kg por semana.")
        .max(WEEKLY_RATE_RANGE_KG.max, "El ritmo máximo es 1 kg por semana."),
    ),
  })
  .superRefine((value, ctx) => {
    if (isValidIsoDate(value.birthDate)) {
      const today = new Date();
      if (value.birthDate > today.toISOString().slice(0, 10)) {
        ctx.addIssue({
          code: "custom",
          path: ["birthDate"],
          message: "La fecha de nacimiento no puede ser futura.",
        });
      } else {
        const age = ageOn(value.birthDate, today);
        if (age < MIN_AGE || age > MAX_AGE) {
          ctx.addIssue({
            code: "custom",
            path: ["birthDate"],
            message: `La edad debe estar entre ${MIN_AGE} y ${MAX_AGE} años.`,
          });
        }
      }
    }

    if (value.goalType === "weight") {
      const w = value.targetWeightKg;
      if (w === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["targetWeightKg"],
          message: "Ingresa tu peso objetivo en kg.",
        });
      } else if (w < TARGET_WEIGHT_RANGE_KG.min || w > TARGET_WEIGHT_RANGE_KG.max) {
        ctx.addIssue({
          code: "custom",
          path: ["targetWeightKg"],
          message: `El peso objetivo debe estar entre ${TARGET_WEIGHT_RANGE_KG.min} y ${TARGET_WEIGHT_RANGE_KG.max} kg.`,
        });
      }
    } else {
      const b = value.targetBmi;
      if (b === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["targetBmi"],
          message: "Ingresa tu IMC objetivo.",
        });
      } else if (b < TARGET_BMI_RANGE.min || b > TARGET_BMI_RANGE.max) {
        ctx.addIssue({
          code: "custom",
          path: ["targetBmi"],
          message: `El IMC objetivo debe estar entre ${TARGET_BMI_RANGE.min} y ${TARGET_BMI_RANGE.max}.`,
        });
      } else if (Number.isFinite(value.heightCm)) {
        const w = weightForBmi(b, value.heightCm);
        if (w < TARGET_WEIGHT_RANGE_KG.min || w > TARGET_WEIGHT_RANGE_KG.max) {
          ctx.addIssue({
            code: "custom",
            path: ["targetBmi"],
            message: "Ese IMC equivale a un peso fuera de rango para tu estatura.",
          });
        }
      }
    }
  });

export type ProfileFormValues = z.output<typeof profileFormSchema>;
export type FieldErrors = Partial<Record<string, string>>;

export const FORM_FIELDS = [
  "sex",
  "birthDate",
  "heightCm",
  "activityLevel",
  "timezone",
  "goalType",
  "targetWeightKg",
  "targetBmi",
  "goalDirection",
  "weeklyRateKg",
] as const;

export type ParseResult =
  { success: true; data: ProfileFormValues } | { success: false; errors: FieldErrors };

/** Valida los campos de un `FormData` (o de un objeto plano) con el esquema. */
export function parseProfileForm(input: FormData | Record<string, unknown>): ParseResult {
  const raw: Record<string, unknown> = {};
  for (const field of FORM_FIELDS) {
    const value = input instanceof FormData ? input.get(field) : input[field];
    if (value !== null && value !== undefined) raw[field] = value;
  }
  const result = profileFormSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { success: false, errors };
}
