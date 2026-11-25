import type { Totals } from "@/lib/meal/day";

/** kcal por gramo de cada macronutriente (factores de Atwater, docs/03). */
export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;

export interface MacroShare {
  key: "protein" | "carb" | "fat";
  label: string;
  grams: number;
  /** Porción (0–100) de las kcal de los macros; 0 si no hay ingesta. */
  pct: number;
}

/** Reparto de la ingesta del día entre proteínas, carbohidratos y grasas. */
export function macroShares(totals: Totals): MacroShare[] {
  const kcal = {
    protein: totals.proteinG * KCAL_PER_G.protein,
    carb: totals.carbG * KCAL_PER_G.carb,
    fat: totals.fatG * KCAL_PER_G.fat,
  };
  const sum = kcal.protein + kcal.carb + kcal.fat;
  const pct = (v: number) => (sum > 0 ? (v / sum) * 100 : 0);
  return [
    {
      key: "protein",
      label: "Proteínas",
      grams: totals.proteinG,
      pct: pct(kcal.protein),
    },
    { key: "carb", label: "Carbohidratos", grams: totals.carbG, pct: pct(kcal.carb) },
    { key: "fat", label: "Grasas", grams: totals.fatG, pct: pct(kcal.fat) },
  ];
}

/** Avance del anillo: consumido / meta, acotado a 0–1 (0 si la meta no es positiva). */
export function ringFraction(consumedKcal: number, goalKcal: number): number {
  if (!(goalKcal > 0) || !(consumedKcal > 0)) return 0;
  return Math.min(1, consumedKcal / goalKcal);
}
