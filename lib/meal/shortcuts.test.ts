import { describe, expect, it } from "vitest";

import {
  favoritesToQuick,
  parseCopyForm,
  parseFavoriteForm,
  pickRecents,
  planCopy,
  quickDefault,
  type CopySourceEntry,
  type CopySourceItem,
  type RecentRow,
} from "./shortcuts";

const A = "0b6c1b5e-6a51-4f7e-9d0a-3c1f2a4b5c6d";
const B = "6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const C = "11111111-1111-4111-8111-111111111111";
const PORTION = "22222222-2222-4222-8222-222222222222";

function recent(over: Partial<RecentRow> & { food_id: string; created_at: string }) {
  return {
    quantity: 100,
    unit: "g",
    portion_id: null,
    grams_resolved: 100,
    food: {
      name_es: `Alimento ${over.food_id.slice(0, 2)}`,
      brand: null,
      basis: "per_100g",
    },
    food_portion: null,
    ...over,
  } satisfies RecentRow;
}

describe("pickRecents", () => {
  it("deja el registro más nuevo de cada alimento, del más reciente al más antiguo", () => {
    const rows = [
      recent({ food_id: A, created_at: "2026-11-20T10:00:00Z", quantity: 50 }),
      recent({ food_id: B, created_at: "2026-11-24T10:00:00Z" }),
      recent({ food_id: A, created_at: "2026-11-23T10:00:00Z", quantity: 180 }),
    ];
    const result = pickRecents(rows);
    expect(result.map((r) => r.foodId)).toEqual([B, A]);
    expect(result[1]).toMatchObject({ unit: "g", quantity: 180 });
  });

  it("respeta el límite y omite filas sin alimento", () => {
    const rows = [
      recent({ food_id: A, created_at: "2026-11-24T10:00:00Z" }),
      recent({ food_id: B, created_at: "2026-11-23T10:00:00Z" }),
      recent({ food_id: C, created_at: "2026-11-25T10:00:00Z", food: null }),
    ];
    expect(pickRecents(rows, 1).map((r) => r.foodId)).toEqual([A]);
    expect(pickRecents(rows, 5).map((r) => r.foodId)).toEqual([A, B]);
  });

  it("conserva la porción usada por última vez", () => {
    const [item] = pickRecents([
      recent({
        food_id: A,
        created_at: "2026-11-24T10:00:00Z",
        unit: "portion",
        quantity: 1.5,
        portion_id: PORTION,
        food_portion: { label_es: "taza" },
      }),
    ]);
    expect(item).toMatchObject({
      unit: "portion",
      quantity: 1.5,
      portionId: PORTION,
      portionLabel: "taza",
    });
  });
});

describe("quickDefault", () => {
  it("si la porción ya no existe usa la unidad base con los gramos resueltos", () => {
    const row = recent({
      food_id: A,
      created_at: "2026-11-24T10:00:00Z",
      unit: "portion",
      quantity: 2,
      grams_resolved: 316,
    });
    expect(quickDefault(row, "per_100g")).toEqual({
      unit: "g",
      quantity: 316,
      portionId: null,
      portionLabel: null,
    });
    expect(quickDefault(row, "per_100ml").unit).toBe("ml");
  });

  it("una unidad desconocida cae a la unidad base", () => {
    const row = recent({ food_id: A, created_at: "x", unit: "taza" });
    expect(quickDefault(row, "per_100ml").unit).toBe("ml");
  });
});

describe("favoritesToQuick", () => {
  const food = { name_es: "Palta", brand: null, basis: "per_100g" };

  it("usa la última cantidad registrada, o 100 g si nunca se usó", () => {
    const result = favoritesToQuick(
      [
        { food_id: A, food },
        { food_id: B, food: { ...food, basis: "per_100ml" } },
        { food_id: C, food: null },
      ],
      [
        recent({ food_id: A, created_at: "2026-11-20T10:00:00Z", quantity: 30 }),
        recent({ food_id: A, created_at: "2026-11-22T10:00:00Z", quantity: 45 }),
      ],
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ foodId: A, unit: "g", quantity: 45 });
    expect(result[1]).toMatchObject({ foodId: B, unit: "ml", quantity: 100 });
  });
});

function item(over: Partial<CopySourceItem> & { created_at: string }): CopySourceItem {
  return {
    food_id: A,
    quantity: 180,
    unit: "g",
    portion_id: null,
    grams_resolved: 180,
    kcal: 234,
    kcal_estimated: false,
    protein_g: 4.9,
    carb_g: 50.4,
    fat_g: 0.5,
    nutrients: { energy_kcal: 234 },
    ...over,
  };
}

const source: CopySourceEntry[] = [
  {
    meal_type: "almuerzo",
    meal_item: [
      item({ created_at: "2026-11-24T13:05:00Z", food_id: B }),
      item({ created_at: "2026-11-24T13:00:00Z" }),
    ],
  },
  { meal_type: "desayuno", meal_item: [item({ created_at: "2026-11-24T08:00:00Z" })] },
  { meal_type: "cena", meal_item: [] },
  { meal_type: "merienda", meal_item: [item({ created_at: "2026-11-24T17:00:00Z" })] },
];

describe("planCopy", () => {
  it("copia el día en el orden de las comidas, con la instantánea tal cual", () => {
    const plan = planCopy(source, new Set());
    expect(plan.meals.map((m) => m.mealType)).toEqual(["desayuno", "almuerzo"]);
    expect(plan.skipped).toEqual([]);
    const lunch = plan.meals[1]!;
    expect(lunch.items.map((i) => i.food_id)).toEqual([A, B]);
    expect(lunch.items[0]).toEqual({
      food_id: A,
      quantity: 180,
      unit: "g",
      portion_id: null,
      grams_resolved: 180,
      kcal: 234,
      kcal_estimated: false,
      protein_g: 4.9,
      carb_g: 50.4,
      fat_g: 0.5,
      nutrients: { energy_kcal: 234 },
    });
    expect(lunch.items[0]).not.toHaveProperty("created_at");
  });

  it("no copia las comidas que el destino ya tiene (evita duplicar)", () => {
    const plan = planCopy(source, new Set(["almuerzo" as const]));
    expect(plan.meals.map((m) => m.mealType)).toEqual(["desayuno"]);
    expect(plan.skipped).toEqual(["almuerzo"]);
  });

  it("puede limitarse a una comida", () => {
    expect(planCopy(source, new Set(), "desayuno").meals.map((m) => m.mealType)).toEqual([
      "desayuno",
    ]);
    expect(planCopy(source, new Set(), "once")).toEqual({ meals: [], skipped: [] });
  });

  it("une varias comidas del mismo tipo y no mezcla nada si el origen está vacío", () => {
    const merged = planCopy(
      [
        { meal_type: "once", meal_item: [item({ created_at: "2026-11-24T17:00:00Z" })] },
        { meal_type: "once", meal_item: [item({ created_at: "2026-11-24T16:00:00Z" })] },
      ],
      new Set(),
    );
    expect(merged.meals).toHaveLength(1);
    expect(merged.meals[0]!.items).toHaveLength(2);
    expect(planCopy([], new Set())).toEqual({ meals: [], skipped: [] });
  });
});

describe("parseCopyForm", () => {
  const today = "2026-11-25";

  it("acepta el día completo (comida vacía) o una comida", () => {
    expect(parseCopyForm({ date: today, mealType: "" }, today)).toEqual({
      success: true,
      data: { date: today, mealType: null },
    });
    expect(parseCopyForm({ date: "2026-11-24", mealType: "desayuno" }, today)).toEqual({
      success: true,
      data: { date: "2026-11-24", mealType: "desayuno" },
    });
  });

  it("lee un FormData sin comida", () => {
    const fd = new FormData();
    fd.set("date", today);
    expect(parseCopyForm(fd, today).success).toBe(true);
  });

  it("rechaza fecha inválida o futura y comida desconocida", () => {
    expect(parseCopyForm({ date: "2026-02-30" }, today).success).toBe(false);
    expect(parseCopyForm({ date: "2026-11-26" }, today)).toEqual({
      success: false,
      message: "La fecha no puede ser futura.",
    });
    expect(parseCopyForm({ date: today, mealType: "merienda" }, today).success).toBe(
      false,
    );
  });
});

describe("parseFavoriteForm", () => {
  it("valida el alimento y el estado", () => {
    expect(parseFavoriteForm({ foodId: A, favorite: "true" })).toEqual({
      foodId: A,
      favorite: true,
    });
    expect(parseFavoriteForm({ foodId: A, favorite: "false" })?.favorite).toBe(false);
    expect(parseFavoriteForm({ foodId: "x", favorite: "true" })).toBeNull();
    expect(parseFavoriteForm({ foodId: A, favorite: "si" })).toBeNull();
  });
});
