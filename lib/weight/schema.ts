import { z } from "zod";

/** Límites del CHECK de `body_measurement.weight_kg`. */
export const WEIGHT_RANGE_KG = { min: 20, max: 400 } as const;

function toNumber(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (text === "") return undefined;
  return Number(text.replace(",", "."));
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type WeightFieldErrors = Partial<Record<"weightKg" | "date", string>>;

export type WeightParseResult =
  | { success: true; data: { weightKg: number; date: string } }
  | { success: false; errors: WeightFieldErrors };

/**
 * Valida el formulario de peso. `today` (AAAA-MM-DD) es el día actual del usuario:
 * la fecha no puede ser posterior.
 */
export function parseWeightForm(
  input: FormData | Record<string, unknown>,
  today: string,
): WeightParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];

  const schema = z.object({
    weightKg: z.preprocess(
      toNumber,
      z
        .number({ error: "Ingresa tu peso en kg." })
        .finite("Ingresa tu peso en kg.")
        .min(
          WEIGHT_RANGE_KG.min,
          `El peso debe ser de al menos ${WEIGHT_RANGE_KG.min} kg.`,
        )
        .max(
          WEIGHT_RANGE_KG.max,
          `El peso debe ser de como máximo ${WEIGHT_RANGE_KG.max} kg.`,
        ),
    ),
    date: z
      .string({ error: "Ingresa la fecha." })
      .refine(isValidIsoDate, "Ingresa una fecha válida.")
      .refine((d) => !isValidIsoDate(d) || d <= today, "La fecha no puede ser futura."),
  });

  const result = schema.safeParse({ weightKg: get("weightKg"), date: get("date") });
  if (result.success) {
    return {
      success: true,
      data: {
        weightKg: Math.round(result.data.weightKg * 100) / 100,
        date: result.data.date,
      },
    };
  }
  const errors: WeightFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] === "date" ? "date" : "weightKg";
    errors[key] ??= issue.message;
  }
  return { success: false, errors };
}
