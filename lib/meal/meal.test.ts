import { describe, expect, it } from "vitest";

import { groupDay, quantityLabel, shiftDay, sumTotals, type DayItemRow } from "./day";
import { defaultMealType, hourIn, isMealType } from "./meal-types";
import { parseMealItemForm } from "./schema";
import { buildMealItemSnapshot, roundTo, toBasis, type FoodForLogging } from "./snapshot";

const today = "2026-11-25";
const FOOD_ID = "0b6c1b5e-6a51-4f7e-9d0a-3c1f2a4b5c6d";
const PORTION_ID = "6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

const valid = {
  foodId: FOOD_ID,
  unit: "g",
  quantity: "180",
  mealType: "almuerzo",
  date: today,
};

function errorsOf(input: Record<string, unknown>) {
  const result = parseMealItemForm(input, today);
  if (result.success) throw new Error("se esperaba un error");
  return result.errors;
}

describe("parseMealItemForm", () => {
  it("acepta gramos y redondea a 1 decimal", () => {
    expect(parseMealItemForm({ ...valid, quantity: "180,26" }, today)).toEqual({
      success: true,
      data: {
        foodId: FOOD_ID,
        unit: "g",
        quantity: 180.3,
        portionId: null,
        mealType: "almuerzo",
        date: today,
      },
    });
  });

  it("acepta porciones con 2 decimales y exige la porción", () => {
    const ok = parseMealItemForm(
      { ...valid, unit: "portion", quantity: "1,25", portionId: PORTION_ID },
      today,
    );
    expect(ok.success && ok.data).toMatchObject({
      unit: "portion",
      quantity: 1.25,
      portionId: PORTION_ID,
    });
    expect(
      errorsOf({ ...valid, unit: "portion", quantity: "1" }).portionId,
    ).toBeDefined();
  });

  it("ignora la porción si la unidad no es porción", () => {
    const r = parseMealItemForm({ ...valid, unit: "ml", portionId: PORTION_ID }, today);
    expect(r.success && r.data.portionId).toBeNull();
  });

  it("lee un FormData", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, v);
    expect(parseMealItemForm(fd, today).success).toBe(true);
  });

  it("valida alimento, unidad y comida", () => {
    expect(errorsOf({ ...valid, foodId: "x" }).foodId).toBeDefined();
    expect(errorsOf({ ...valid, unit: "taza" }).unit).toBeDefined();
    expect(errorsOf({ ...valid, mealType: "merienda" }).mealType).toBeDefined();
  });

  it("valida el rango de la cantidad", () => {
    expect(errorsOf({ ...valid, quantity: "" }).quantity).toBeDefined();
    expect(errorsOf({ ...valid, quantity: "abc" }).quantity).toBeDefined();
    expect(errorsOf({ ...valid, quantity: "0" }).quantity).toMatch(/0,1/);
    expect(errorsOf({ ...valid, quantity: "0,04" }).quantity).toBeDefined();
    expect(errorsOf({ ...valid, quantity: "5001" }).quantity).toMatch(/5000|5\.000/);
    expect(
      errorsOf({ ...valid, unit: "portion", portionId: PORTION_ID, quantity: "51" })
        .quantity,
    ).toMatch(/porciones/);
  });

  it("valida la fecha (formato, inexistente y futura)", () => {
    expect(errorsOf({ ...valid, date: "" }).date).toBeDefined();
    expect(errorsOf({ ...valid, date: "2026-02-30" }).date).toBeDefined();
    expect(errorsOf({ ...valid, date: "2026-11-26" }).date).toMatch(/futura/);
  });
});

const rice: FoodForLogging = {
  basis: "per_100g",
  densityGMl: null,
  per100: { energy_kcal: 130, protein_g: 2.7, carb_g: 28, fat_g: 0.3, sodium_mg: 1 },
  portions: [{ id: PORTION_ID, grams: 158 }],
};

describe("buildMealItemSnapshot", () => {
  it("HU-03: 180 g de arroz cocido → 234 kcal, macros a 1 decimal", () => {
    const r = buildMealItemSnapshot(rice, { unit: "g", quantity: 180, portionId: null });
    expect(r).toEqual({
      ok: true,
      densityAssumed: false,
      snapshot: {
        quantity: 180,
        unit: "g",
        portion_id: null,
        grams_resolved: 180,
        kcal: 234,
        kcal_estimated: false,
        protein_g: 4.9,
        carb_g: 50.4,
        fat_g: 0.5,
        nutrients: {
          energy_kcal: 234,
          protein_g: 4.86,
          carb_g: 50.4,
          fat_g: 0.54,
          sodium_mg: 1.8,
        },
      },
    });
  });

  it("porción: gramos resueltos y porción guardada", () => {
    const r = buildMealItemSnapshot(rice, {
      unit: "portion",
      quantity: 1.5,
      portionId: PORTION_ID,
    });
    expect(r.ok && r.snapshot).toMatchObject({
      unit: "portion",
      portion_id: PORTION_ID,
      grams_resolved: 237,
      kcal: 308.1,
    });
  });

  it("rechaza una porción de otro alimento y una unidad distinta de la base", () => {
    expect(
      buildMealItemSnapshot(rice, {
        unit: "portion",
        quantity: 1,
        portionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ ok: false, errors: { portionId: "Elige una porción válida." } });
    const wrong = buildMealItemSnapshot(rice, {
      unit: "ml",
      quantity: 100,
      portionId: null,
    });
    expect(wrong.ok === false && wrong.errors.unit).toMatch(/en g/);
  });

  it("ml sobre un líquido con densidad", () => {
    const milk: FoodForLogging = {
      basis: "per_100ml",
      densityGMl: 1.03,
      per100: { energy_kcal: 42, protein_g: 3.4, carb_g: 5, fat_g: 1 },
      portions: [],
    };
    const r = buildMealItemSnapshot(milk, { unit: "ml", quantity: 250, portionId: null });
    expect(r.ok && r.snapshot).toMatchObject({
      unit: "ml",
      grams_resolved: 257.5,
      kcal: 105,
      protein_g: 8.5,
      carb_g: 12.5,
      fat_g: 2.5,
    });
  });

  it("porción de líquido sin densidad marca que se asumió 1 g/ml", () => {
    const juice: FoodForLogging = {
      basis: "per_100ml",
      densityGMl: null,
      per100: { energy_kcal: 45 },
      portions: [{ id: PORTION_ID, grams: 240 }],
    };
    const r = buildMealItemSnapshot(juice, {
      unit: "portion",
      quantity: 1,
      portionId: PORTION_ID,
    });
    expect(r.ok && r.densityAssumed).toBe(true);
    expect(r.ok && r.snapshot.kcal).toBe(108);
  });

  it("macros faltantes en 0 y fuera de la instantánea; kcal estimadas si falta energía", () => {
    const r = buildMealItemSnapshot(
      { ...rice, per100: { protein_g: 10, fat_g: 5 } },
      { unit: "g", quantity: 50, portionId: null },
    );
    expect(r.ok && r.snapshot).toMatchObject({
      kcal: 42.5,
      kcal_estimated: true,
      protein_g: 5,
      carb_g: 0,
      fat_g: 2.5,
      nutrients: { protein_g: 5, fat_g: 2.5 },
    });
  });

  it("sin energía ni macros no se registra", () => {
    const r = buildMealItemSnapshot(
      { ...rice, per100: { sodium_mg: 10 } },
      { unit: "g", quantity: 50, portionId: null },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/no se puede registrar/);
  });

  it("cantidad que redondea a 0 g se rechaza", () => {
    const r = buildMealItemSnapshot(
      { ...rice, portions: [{ id: PORTION_ID, grams: 0.2 }] },
      { unit: "portion", quantity: 0.1, portionId: PORTION_ID },
    );
    expect(r.ok === false && r.errors.quantity).toBeDefined();
  });

  it("la instantánea es un objeto nuevo: editar el alimento después no la cambia", () => {
    const food = { ...rice, per100: { ...rice.per100 } };
    const r = buildMealItemSnapshot(food, { unit: "g", quantity: 100, portionId: null });
    food.per100.energy_kcal = 999;
    expect(r.ok && r.snapshot.kcal).toBe(130);
    expect(r.ok && r.snapshot.nutrients.energy_kcal).toBe(130);
  });
});

describe("redondeo y base", () => {
  it("roundTo es half-up estable", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(0.05, 1)).toBe(0.1);
    expect(roundTo(4.86, 1)).toBe(4.9);
    expect(roundTo(0.04, 1)).toBe(0);
  });

  it("toBasis normaliza valores desconocidos a per_100g", () => {
    expect(toBasis("per_100ml")).toBe("per_100ml");
    expect(toBasis("per_100g")).toBe("per_100g");
    expect(toBasis("otra")).toBe("per_100g");
  });
});

describe("tipo de comida por hora", () => {
  it.each([
    [0, "colacion"],
    [4, "colacion"],
    [5, "desayuno"],
    [10, "desayuno"],
    [11, "colacion"],
    [12, "almuerzo"],
    [15, "almuerzo"],
    [16, "once"],
    [19, "once"],
    [20, "cena"],
    [23, "cena"],
  ] as const)("a las %i h sugiere %s", (hour, type) => {
    expect(defaultMealType(hour)).toBe(type);
  });

  it("hourIn usa la zona del usuario", () => {
    const now = new Date("2026-11-25T15:30:00Z");
    expect(hourIn("America/Santiago", now)).toBe(12);
    expect(hourIn("UTC", now)).toBe(15);
    expect(hourIn("Marte/Olimpo", now)).toBe(15);
  });

  it("isMealType", () => {
    expect(isMealType("once")).toBe(true);
    expect(isMealType("merienda")).toBe(false);
    expect(isMealType(3)).toBe(false);
  });
});

function item(partial: Partial<DayItemRow> & { id: string }): DayItemRow {
  return {
    quantity: 100,
    unit: "g",
    grams_resolved: 100,
    kcal: 100,
    kcal_estimated: false,
    protein_g: 1,
    carb_g: 2,
    fat_g: 3,
    created_at: "2026-11-25T12:00:00Z",
    food: { name_es: "Pan", brand: null, source: "usda_fdc" },
    food_portion: null,
    ...partial,
  };
}

describe("día de comidas", () => {
  it("agrupa por tipo en el orden del día con totales", () => {
    const { meals, totals } = groupDay([
      { id: "e1", meal_type: "cena", meal_item: [item({ id: "c1", kcal: 500.4 })] },
      {
        id: "e2",
        meal_type: "desayuno",
        meal_item: [
          item({ id: "d2", created_at: "2026-11-25T09:00:00Z", kcal: 50.1 }),
          item({ id: "d1", created_at: "2026-11-25T08:00:00Z", kcal: 200.2 }),
        ],
      },
      { id: "e3", meal_type: "desayuno", meal_item: [item({ id: "d3", kcal: 0.1 })] },
      { id: "e4", meal_type: "almuerzo", meal_item: [] },
      { id: "e5", meal_type: "otro", meal_item: [item({ id: "x" })] },
    ]);
    expect(meals.map((m) => m.type)).toEqual(["desayuno", "cena"]);
    expect(meals[0]?.label).toBe("Desayuno");
    expect(meals[0]?.items.map((i) => i.id)).toEqual(["d1", "d2", "d3"]);
    expect(meals[0]?.totals).toEqual({ kcal: 250.4, proteinG: 3, carbG: 6, fatG: 9 });
    expect(totals).toEqual({ kcal: 750.8, proteinG: 4, carbG: 8, fatG: 12 });
  });

  it("un día sin registros da totales en 0", () => {
    expect(groupDay([])).toEqual({
      meals: [],
      totals: { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
    });
  });

  it("alimento no visible conserva la instantánea con un nombre genérico", () => {
    const { meals } = groupDay([
      { id: "e", meal_type: "once", meal_item: [item({ id: "i", food: null })] },
    ]);
    expect(meals[0]?.items[0]).toMatchObject({ foodName: "Alimento", source: null });
  });

  it("sumTotals evita el arrastre de coma flotante", () => {
    expect(
      sumTotals([
        { kcal: 0.1, proteinG: 0.1, carbG: 0.2, fatG: 0.7 },
        { kcal: 0.2, proteinG: 0.2, carbG: 0.1, fatG: 0.1 },
      ]),
    ).toEqual({ kcal: 0.3, proteinG: 0.3, carbG: 0.3, fatG: 0.8 });
  });

  it("textos de cantidad", () => {
    expect(quantityLabel({ quantity: 180, unit: "g", grams_resolved: 180 })).toBe(
      "180 g",
    );
    expect(quantityLabel({ quantity: 250.5, unit: "ml", grams_resolved: 258 })).toBe(
      "250,5 ml",
    );
    expect(
      quantityLabel({
        quantity: 1.5,
        unit: "portion",
        grams_resolved: 237,
        portionLabel: "taza",
      }),
    ).toBe("1,5 × taza (237 g)");
    expect(quantityLabel({ quantity: 1, unit: "portion", grams_resolved: 30 })).toBe(
      "1 porción (30 g)",
    );
    expect(quantityLabel({ quantity: 2, unit: "portion", grams_resolved: 60.5 })).toBe(
      "2 porciones (60,5 g)",
    );
  });

  it("shiftDay cruza meses y años", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});
