import { describe, expect, it } from "vitest";

import { parseCustomFoodForm, toPer100 } from "./custom";

const base = { name: "Yogur", basis: "per_100g", entry: "per100" };

function ok(input: Record<string, unknown>) {
  const result = parseCustomFoodForm(input);
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.data;
}

describe("parseCustomFoodForm", () => {
  it("guarda tal cual los valores ingresados por 100", () => {
    const data = ok({ ...base, energy: "120", protein: "5,5", carb: "10", fat: "6" });
    expect(data.nutrients).toMatchObject({
      energy_kcal: 120,
      protein_g: 5.5,
      carb_g: 10,
      fat_g: 6,
    });
    expect(data.portionSize).toBeNull();
    expect(data.kcalEstimated).toBe(false);
  });

  it("convierte de porción a por 100 y conserva el tamaño", () => {
    const data = ok({
      ...base,
      entry: "portion",
      portionSize: "30",
      energy: "120",
      protein: "3",
      sodium: "150",
    });
    expect(data.nutrients).toMatchObject({
      energy_kcal: 400,
      protein_g: 10,
      sodium_mg: 500,
    });
    expect(data.portionSize).toBe(30);
  });

  it("convierte porciones en ml", () => {
    expect(toPer100(100, 250)).toBe(40);
    const data = ok({
      name: "Jugo",
      basis: "per_100ml",
      entry: "portion",
      portionSize: "250",
      energy: "100",
    });
    expect(data.basis).toBe("per_100ml");
    expect(data.nutrients.energy_kcal).toBe(40);
  });

  it("estima las kcal desde los macros si falta la energía", () => {
    const data = ok({ ...base, protein: "10", carb: "20", fat: "5" });
    expect(data.nutrients.energy_kcal).toBe(165);
    expect(data.kcalEstimated).toBe(true);
  });

  it("exige energía o algún macro", () => {
    const result = parseCustomFoodForm({ ...base, sodium: "100" });
    expect(result.success).toBe(false);
  });

  it("exige tamaño de porción cuando se ingresa por porción", () => {
    const result = parseCustomFoodForm({ ...base, entry: "portion", energy: "100" });
    expect(!result.success && result.errors.portionSize).toBeTruthy();
  });

  it("valida los umbrales por 100 tras convertir", () => {
    const kcal = parseCustomFoodForm({
      ...base,
      entry: "portion",
      portionSize: "10",
      energy: "100",
    });
    expect(!kcal.success && kcal.errors.energy).toBeTruthy();
    const grams = parseCustomFoodForm({ ...base, energy: "100", sugar: "101" });
    expect(!grams.success && grams.errors.sugar).toBeTruthy();
    const sum = parseCustomFoodForm({
      ...base,
      energy: "800",
      protein: "50",
      carb: "50",
      fat: "6",
    });
    expect(!sum.success && sum.errors.form).toBeTruthy();
  });

  it("rechaza negativos, texto y subcomponentes mayores al total", () => {
    expect(parseCustomFoodForm({ ...base, energy: "-1" }).success).toBe(false);
    expect(parseCustomFoodForm({ ...base, energy: "abc" }).success).toBe(false);
    const sat = parseCustomFoodForm({ ...base, energy: "100", fat: "2", saturated: "3" });
    expect(!sat.success && sat.errors.saturated).toBeTruthy();
  });

  it("valida nombre y base", () => {
    const result = parseCustomFoodForm({ energy: "10", name: " ", basis: "x" });
    expect(!result.success && result.errors.name && result.errors.basis).toBeTruthy();
  });
});
