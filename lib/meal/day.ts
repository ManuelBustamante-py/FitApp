import { MEAL_TYPE_LABELS, MEAL_TYPES, isMealType, type MealType } from "./meal-types";
import { roundTo } from "./snapshot";

/** Fila de `meal_item` con su alimento y porción, como la devuelve la consulta del día. */
export interface DayItemRow {
  id: string;
  quantity: number;
  unit: string;
  grams_resolved: number;
  kcal: number;
  kcal_estimated: boolean;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  created_at: string;
  food: { name_es: string; brand: string | null; source: string } | null;
  food_portion: { label_es: string } | null;
}

export interface DayEntryRow {
  id: string;
  meal_type: string;
  meal_item: DayItemRow[];
}

export interface Totals {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface DayItem extends Totals {
  id: string;
  foodName: string;
  brand: string | null;
  source: string | null;
  quantityLabel: string;
  kcalEstimated: boolean;
}

export interface DayMeal {
  type: MealType;
  label: string;
  items: DayItem[];
  totals: Totals;
}

const nfQuantity = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const nfGrams = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

/** Texto de la cantidad: «180 g», «250 ml», «1,5 × taza (237 g)». */
export function quantityLabel(
  item: Pick<DayItemRow, "quantity" | "unit" | "grams_resolved"> & {
    portionLabel?: string | null;
  },
): string {
  const quantity = nfQuantity.format(item.quantity);
  if (item.unit === "portion") {
    const name = item.portionLabel ?? (item.quantity === 1 ? "porción" : "porciones");
    const sep = item.portionLabel ? " × " : " ";
    return `${quantity}${sep}${name} (${nfGrams.format(item.grams_resolved)} g)`;
  }
  return `${quantity} ${item.unit === "ml" ? "ml" : "g"}`;
}

/** Suma kcal y macros (1 decimal, para evitar arrastre de coma flotante). */
export function sumTotals(items: readonly Totals[]): Totals {
  const total = items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      proteinG: acc.proteinG + item.proteinG,
      carbG: acc.carbG + item.carbG,
      fatG: acc.fatG + item.fatG,
    }),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );
  return {
    kcal: roundTo(total.kcal, 1),
    proteinG: roundTo(total.proteinG, 1),
    carbG: roundTo(total.carbG, 1),
    fatG: roundTo(total.fatG, 1),
  };
}

/**
 * Agrupa los registros de un día por tipo de comida (RF-17), en el orden del día,
 * con los totales de cada comida y del día (RF-18). Las comidas sin ítems se omiten;
 * los ítems de una misma comida van del más antiguo al más nuevo.
 */
export function groupDay(entries: readonly DayEntryRow[]): {
  meals: DayMeal[];
  totals: Totals;
} {
  const byType = new Map<MealType, DayItemRow[]>();
  for (const entry of entries) {
    if (!isMealType(entry.meal_type)) continue;
    const list = byType.get(entry.meal_type) ?? [];
    list.push(...entry.meal_item);
    byType.set(entry.meal_type, list);
  }

  const meals: DayMeal[] = [];
  for (const type of MEAL_TYPES) {
    const rows = byType.get(type);
    if (!rows || rows.length === 0) continue;
    const items = [...rows]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((row): DayItem => ({
        id: row.id,
        foodName: row.food?.name_es ?? "Alimento",
        brand: row.food?.brand ?? null,
        source: row.food?.source ?? null,
        quantityLabel: quantityLabel({
          ...row,
          portionLabel: row.food_portion?.label_es ?? null,
        }),
        kcalEstimated: row.kcal_estimated,
        kcal: row.kcal,
        proteinG: row.protein_g,
        carbG: row.carb_g,
        fatG: row.fat_g,
      }));
    meals.push({ type, label: MEAL_TYPE_LABELS[type], items, totals: sumTotals(items) });
  }
  return { meals, totals: sumTotals(meals.map((m) => m.totals)) };
}

/** Día anterior o siguiente (AAAA-MM-DD). */
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
