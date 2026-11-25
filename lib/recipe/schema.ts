import { toNumber } from "@/lib/activity/schema";
import { isUuid } from "@/lib/meal/schema";

export const MAX_RECIPE_NAME_LENGTH = 120;
export const MAX_INGREDIENTS = 50;
export const GRAMS_RANGE = { min: 0.1, max: 99999 } as const;
export const COOKED_RANGE = { min: 1, max: 99999 } as const;
export const SERVINGS_RANGE = { min: 0.5, max: 100 } as const;

export type RecipeField = "name" | "cookedWeight" | "servings" | "ingredients";
export type RecipeFieldErrors = Partial<Record<RecipeField, string>>;

export interface RecipeValues {
  name: string;
  cookedWeightG: number;
  servings: number | null;
  /** Un ingrediente por alimento: si se repite, se suman los gramos. */
  ingredients: { foodId: string; grams: number }[];
}

export type RecipeParseResult =
  { success: true; data: RecipeValues } | { success: false; errors: RecipeFieldErrors };

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Valida el formulario de receta (RF-20). Los ingredientes llegan como JSON en el campo
 * `ingredients` (`[{ foodId, grams }]`). Los límites nutricionales por 100 g se validan
 * en el servidor con los alimentos leídos de la base (`computeRecipePer100`).
 */
export function parseRecipeForm(
  input: FormData | Record<string, unknown>,
): RecipeParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const errors: RecipeFieldErrors = {};

  const name = String(get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (name === "" || name.length > MAX_RECIPE_NAME_LENGTH)
    errors.name = `Ingresa el nombre (hasta ${MAX_RECIPE_NAME_LENGTH} caracteres).`;

  const cookedRaw = toNumber(get("cookedWeight"));
  const cookedWeightG = cookedRaw === null ? NaN : round1(cookedRaw);
  if (
    !Number.isFinite(cookedWeightG) ||
    cookedWeightG < COOKED_RANGE.min ||
    cookedWeightG > COOKED_RANGE.max
  )
    errors.cookedWeight = "Ingresa el peso final cocido en gramos (mayor que 0).";

  let servings: number | null = null;
  const servingsText = String(get("servings") ?? "").trim();
  if (servingsText !== "") {
    const raw = toNumber(servingsText);
    const value = raw === null ? NaN : round1(raw);
    if (
      !Number.isFinite(value) ||
      value < SERVINGS_RANGE.min ||
      value > SERVINGS_RANGE.max
    )
      errors.servings = `Las porciones deben estar entre ${SERVINGS_RANGE.min} y ${SERVINGS_RANGE.max}.`;
    else servings = value;
  }

  const ingredients = new Map<string, number>();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(get("ingredients") ?? "[]"));
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    errors.ingredients = "Agrega al menos un ingrediente.";
  } else if (parsed.length > MAX_INGREDIENTS) {
    errors.ingredients = `Una receta admite hasta ${MAX_INGREDIENTS} ingredientes.`;
  } else {
    for (const row of parsed as { foodId?: unknown; grams?: unknown }[]) {
      const grams = toNumber(row?.grams);
      if (
        !isUuid(row?.foodId) ||
        grams === null ||
        !Number.isFinite(grams) ||
        grams < GRAMS_RANGE.min ||
        grams > GRAMS_RANGE.max
      ) {
        errors.ingredients =
          "Cada ingrediente necesita un alimento y gramos mayores que 0.";
        break;
      }
      ingredients.set(row.foodId, round1((ingredients.get(row.foodId) ?? 0) + grams));
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      name,
      cookedWeightG,
      servings,
      ingredients: [...ingredients].map(([foodId, grams]) => ({ foodId, grams })),
    },
  };
}
