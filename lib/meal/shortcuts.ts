import { z } from "zod";

import { basisUnit, type FoodBasis, type QuantityUnit } from "@/lib/calc";

import { isMealType, MEAL_TYPES, type MealType } from "./meal-types";
import { isUuid } from "./schema";
import { toBasis } from "./snapshot";

/** Cuántos alimentos recientes se muestran (RF-22). */
export const RECENTS_LIMIT = 12;

/** Cantidad por defecto de un alimento que el usuario aún no ha registrado. */
const DEFAULT_QUANTITY = 100;

/** Fila de `meal_item` con lo necesario para derivar los recientes. */
export interface RecentRow {
  food_id: string;
  quantity: number;
  unit: string;
  portion_id: string | null;
  grams_resolved: number;
  created_at: string;
  food: { name_es: string; brand: string | null; basis: string } | null;
  food_portion: { label_es: string } | null;
}

/** Alimento listo para agregar de un toque, con la última cantidad usada. */
export interface QuickFood {
  foodId: string;
  name: string;
  brand: string | null;
  unit: QuantityUnit;
  quantity: number;
  /** Solo si `unit` es "portion". */
  portionId: string | null;
  portionLabel: string | null;
}

function isQuantityUnit(value: string): value is QuantityUnit {
  return value === "g" || value === "ml" || value === "portion";
}

/**
 * Valor por defecto de la última vez que se usó el alimento. Si la porción ya no
 * existe (portion_id nulo), se usa la unidad base con los gramos resueltos.
 */
export function quickDefault(
  row: RecentRow,
  basis: FoodBasis,
): Pick<QuickFood, "unit" | "quantity" | "portionId" | "portionLabel"> {
  if (row.unit === "portion" && row.portion_id) {
    return {
      unit: "portion",
      quantity: row.quantity,
      portionId: row.portion_id,
      portionLabel: row.food_portion?.label_es ?? null,
    };
  }
  if (row.unit === "portion") {
    return {
      unit: basisUnit(basis),
      quantity: row.grams_resolved,
      portionId: null,
      portionLabel: null,
    };
  }
  return {
    unit: isQuantityUnit(row.unit) ? row.unit : basisUnit(basis),
    quantity: row.quantity,
    portionId: null,
    portionLabel: null,
  };
}

function newestFirst(rows: readonly RecentRow[]): RecentRow[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Alimentos distintos más recientes (RF-22) a partir de los ítems registrados, con
 * su última cantidad y unidad. Las filas pueden venir en cualquier orden.
 */
export function pickRecents(
  rows: readonly RecentRow[],
  limit = RECENTS_LIMIT,
): QuickFood[] {
  const seen = new Set<string>();
  const result: QuickFood[] = [];
  for (const row of newestFirst(rows)) {
    if (result.length >= limit) break;
    if (seen.has(row.food_id) || !row.food) continue;
    seen.add(row.food_id);
    result.push({
      foodId: row.food_id,
      name: row.food.name_es,
      brand: row.food.brand,
      ...quickDefault(row, toBasis(row.food.basis)),
    });
  }
  return result;
}

/** Favorito con su alimento, tal como lo devuelve la consulta. */
export interface FavoriteRow {
  food_id: string;
  food: { name_es: string; brand: string | null; basis: string } | null;
}

/**
 * Favoritos listos para agregar: usan la última cantidad registrada del alimento
 * (en `recentRows`) o 100 g/ml si nunca se usó.
 */
export function favoritesToQuick(
  favorites: readonly FavoriteRow[],
  recentRows: readonly RecentRow[],
): QuickFood[] {
  const lastByFood = new Map<string, RecentRow>();
  for (const row of newestFirst(recentRows))
    if (!lastByFood.has(row.food_id)) lastByFood.set(row.food_id, row);

  return favorites.flatMap((fav): QuickFood[] => {
    if (!fav.food) return [];
    const last = lastByFood.get(fav.food_id);
    const basis = toBasis(fav.food.basis);
    return [
      {
        foodId: fav.food_id,
        name: fav.food.name_es,
        brand: fav.food.brand,
        ...(last
          ? quickDefault(last, basis)
          : {
              unit: basisUnit(basis),
              quantity: DEFAULT_QUANTITY,
              portionId: null,
              portionLabel: null,
            }),
      },
    ];
  });
}

/** Ítem de una comida previa con su instantánea de nutrientes. */
export interface CopySourceItem {
  food_id: string;
  quantity: number;
  unit: string;
  portion_id: string | null;
  grams_resolved: number;
  kcal: number;
  kcal_estimated: boolean;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  nutrients: unknown;
  created_at: string;
}

export interface CopySourceEntry {
  meal_type: string;
  meal_item: CopySourceItem[];
}

export type CopyItem = Omit<CopySourceItem, "created_at">;

export interface CopyPlan {
  /** Comidas a crear, en el orden del día, con sus ítems del más antiguo al más nuevo. */
  meals: { mealType: MealType; items: CopyItem[] }[];
  /** Comidas del origen que no se copian porque el destino ya tiene registros. */
  skipped: MealType[];
}

/**
 * Decide qué copiar de un día de origen a uno de destino. Para no duplicar al
 * repetir la acción, una comida del destino que ya tiene ítems (`occupied`) no se
 * toca: se omite y se informa en `skipped`. `only` limita la copia a una comida.
 * Los ítems se copian tal cual, con su instantánea (no se recalcula con el alimento).
 */
export function planCopy(
  source: readonly CopySourceEntry[],
  occupied: ReadonlySet<MealType>,
  only: MealType | null = null,
): CopyPlan {
  const byType = new Map<MealType, CopySourceItem[]>();
  for (const entry of source) {
    if (!isMealType(entry.meal_type) || (only && entry.meal_type !== only)) continue;
    const list = byType.get(entry.meal_type) ?? [];
    list.push(...entry.meal_item);
    byType.set(entry.meal_type, list);
  }

  const meals: CopyPlan["meals"] = [];
  const skipped: MealType[] = [];
  for (const mealType of MEAL_TYPES) {
    const rows = byType.get(mealType);
    if (!rows || rows.length === 0) continue;
    if (occupied.has(mealType)) {
      skipped.push(mealType);
      continue;
    }
    const items = [...rows]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((row): CopyItem => ({
        food_id: row.food_id,
        quantity: row.quantity,
        unit: row.unit,
        portion_id: row.portion_id,
        grams_resolved: row.grams_resolved,
        kcal: row.kcal,
        kcal_estimated: row.kcal_estimated,
        protein_g: row.protein_g,
        carb_g: row.carb_g,
        fat_g: row.fat_g,
        nutrients: row.nutrients,
      }));
    meals.push({ mealType, items });
  }
  return { meals, skipped };
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const copySchema = z.object({
  date: z.string().refine(isIsoDate),
  mealType: z.enum(MEAL_TYPES).nullable(),
});

export type CopyParseResult =
  | { success: true; data: { date: string; mealType: MealType | null } }
  | { success: false; message: string };

/**
 * Valida el formulario de copia: día de destino (no futuro) y, opcionalmente, la
 * comida a copiar (vacía = el día completo).
 */
export function parseCopyForm(
  input: FormData | Record<string, unknown>,
  today: string,
): CopyParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const rawMeal = get("mealType");
  const parsed = copySchema.safeParse({
    date: get("date"),
    mealType:
      rawMeal === null || rawMeal === undefined || rawMeal === "" ? null : rawMeal,
  });
  if (!parsed.success) return { success: false, message: "Datos de copia no válidos." };
  if (parsed.data.date > today)
    return { success: false, message: "La fecha no puede ser futura." };
  return { success: true, data: parsed.data };
}

/** Valida el formulario de favorito: alimento y si queda marcado o no. */
export function parseFavoriteForm(
  input: FormData | Record<string, unknown>,
): { foodId: string; favorite: boolean } | null {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const foodId = get("foodId");
  const favorite = get("favorite");
  if (!isUuid(foodId) || (favorite !== "true" && favorite !== "false")) return null;
  return { foodId, favorite: favorite === "true" };
}
