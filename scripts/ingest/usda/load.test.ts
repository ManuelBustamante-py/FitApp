import { describe, expect, it } from "vitest";

import {
  buildFoodRow,
  buildNutrientRows,
  buildPortionRows,
  chunk,
  createServiceClient,
  portionId,
} from "./load.ts";
import type { NormalizedFood } from "./normalize.ts";

const food: NormalizedFood = {
  source: "usda_fndds",
  sourceId: "300",
  nameEs: "Leche entera",
  nameEn: "Milk, whole",
  category: "Milk, whole",
  state: "na",
  basis: "per_100g",
  license: "CC0 / dominio público",
  nutrients: { protein_g: 3.27, energy_kcal: 60, unknown_code: 1 },
  portions: [{ sourcePortionId: "30", labelEs: "1 taza", grams: 244 }],
};

describe("chunk", () => {
  it("parte en lotes del tamaño pedido", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe("filas para Supabase", () => {
  it("food: público (owner null) con fuente, licencia y fecha de importación", () => {
    expect(buildFoodRow(food, "id-1", "2026-11-19T00:00:00.000Z")).toEqual({
      id: "id-1",
      name_es: "Leche entera",
      name_en: "Milk, whole",
      brand: null,
      barcode: null,
      category: "Milk, whole",
      state: "na",
      basis: "per_100g",
      density_g_ml: null,
      source: "usda_fndds",
      source_id: "300",
      license: "CC0 / dominio público",
      owner_user_id: null,
      imported_at: "2026-11-19T00:00:00.000Z",
    });
  });

  it("food_nutrient: usa los ids de public.nutrient y omite códigos desconocidos", () => {
    const ids = new Map([
      ["energy_kcal", 1],
      ["protein_g", 2],
    ]);
    expect(buildNutrientRows(food, "id-1", ids)).toEqual([
      { food_id: "id-1", nutrient_id: 1, amount_per_100: 60 },
      { food_id: "id-1", nutrient_id: 2, amount_per_100: 3.27 },
    ]);
  });

  it("food_portion: id determinista, estable entre reimportaciones", () => {
    const [portion] = buildPortionRows(food, "id-1");
    expect(portion).toEqual({
      id: portionId(food, "30"),
      food_id: "id-1",
      label_es: "1 taza",
      grams: 244,
    });
    expect(portion.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-/,
    );
    expect(buildPortionRows(food, "id-1")[0].id).toBe(portion.id);
    expect(portionId({ ...food, sourceId: "301" }, "30")).not.toBe(portion.id);
  });
});

describe("createServiceClient", () => {
  it("exige la URL y la clave secreta en el entorno", () => {
    expect(() => createServiceClient({})).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() =>
      createServiceClient({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }),
    ).toThrow(/Faltan variables/);
  });

  it("crea el cliente con SUPABASE_SERVICE_ROLE_KEY como alternativa", () => {
    const client = createServiceClient({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "clave-de-prueba",
    });
    expect(typeof client.from).toBe("function");
  });
});
