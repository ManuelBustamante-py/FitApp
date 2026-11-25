import { z } from "zod";

import { toNumber } from "@/lib/activity/schema";
import type { QuantityUnit } from "@/lib/calc";

import { MEAL_TYPES, type MealType } from "./meal-types";

/** Límites de cantidad por unidad (dentro del CHECK de `meal_item.quantity`). */
export const QUANTITY_RANGE: Record<QuantityUnit, { min: number; max: number }> = {
  g: { min: 0.1, max: 5000 },
  ml: { min: 0.1, max: 5000 },
  portion: { min: 0.1, max: 50 },
};

/** Decimales que se guardan de la cantidad según la unidad. */
const QUANTITY_DECIMALS: Record<QuantityUnit, number> = { g: 1, ml: 1, portion: 2 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type MealItemField =
  "foodId" | "unit" | "quantity" | "portionId" | "mealType" | "date";

export type MealItemFieldErrors = Partial<Record<MealItemField, string>>;

export interface MealItemFormValues {
  foodId: string;
  unit: QuantityUnit;
  quantity: number;
  /** Solo si `unit` es "portion". */
  portionId: string | null;
  mealType: MealType;
  date: string;
}

export type MealItemParseResult =
  | { success: true; data: MealItemFormValues }
  | { success: false; errors: MealItemFieldErrors };

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const nfQuantity = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

const schema = z.object({
  foodId: z.string().refine(isUuid),
  unit: z.enum(["g", "ml", "portion"]),
  mealType: z.enum(MEAL_TYPES),
});

/**
 * Valida el formulario de registro de un alimento (RF-16, RF-17). `today`
 * (AAAA-MM-DD) es el día actual del usuario: la fecha no puede ser posterior.
 * Que la unidad y la porción correspondan al alimento se revisa con
 * `checkFoodQuantity`, una vez leído el alimento en el servidor.
 */
export function parseMealItemForm(
  input: FormData | Record<string, unknown>,
  today: string,
): MealItemParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const errors: MealItemFieldErrors = {};

  const base = schema.safeParse({
    foodId: get("foodId"),
    unit: get("unit"),
    mealType: get("mealType"),
  });
  if (!base.success) {
    for (const issue of base.error.issues) {
      const key = issue.path[0];
      if (key === "foodId") errors.foodId = "Elige un alimento.";
      if (key === "unit") errors.unit = "Elige la unidad.";
      if (key === "mealType") errors.mealType = "Elige la comida.";
    }
  }
  const unit = base.success ? base.data.unit : null;

  const rawQuantity = toNumber(get("quantity"));
  let quantity: number | null = null;
  if (unit) {
    const range = QUANTITY_RANGE[unit];
    const value =
      rawQuantity === null || !Number.isFinite(rawQuantity)
        ? null
        : round(rawQuantity, QUANTITY_DECIMALS[unit]);
    const what = unit === "portion" ? "el número de porciones" : `la cantidad en ${unit}`;
    if (value === null || value < range.min || value > range.max)
      errors.quantity = `Ingresa ${what} (entre ${nfQuantity.format(range.min)} y ${nfQuantity.format(range.max)}).`;
    else quantity = value;
  }

  const portion = get("portionId");
  let portionId: string | null = null;
  if (unit === "portion") {
    if (isUuid(portion)) portionId = portion;
    else errors.portionId = "Elige una porción.";
  }

  const date = get("date");
  if (!isValidIsoDate(date)) errors.date = "Ingresa una fecha válida.";
  else if (date > today) errors.date = "La fecha no puede ser futura.";

  if (!base.success || Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      foodId: base.data.foodId,
      unit: base.data.unit,
      quantity: quantity as number,
      portionId,
      mealType: base.data.mealType,
      date: date as string,
    },
  };
}
