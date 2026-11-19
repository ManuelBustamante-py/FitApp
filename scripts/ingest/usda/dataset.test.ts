import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { findDatasetDirs, readDataset, readFoodNames } from "./dataset.ts";
import { normalizeFood } from "./normalize.ts";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__");

describe("findDatasetDirs", () => {
  it("encuentra las carpetas con food.csv bajo la ruta dada", () => {
    expect(findDatasetDirs(FIXTURES)).toEqual([
      join(FIXTURES, "fdc"),
      join(FIXTURES, "fndds"),
    ]);
    expect(findDatasetDirs(join(FIXTURES, "fdc"))).toEqual([join(FIXTURES, "fdc")]);
    expect(() => findDatasetDirs(join(FIXTURES, "no-existe"))).toThrow(/No existe/);
  });
});

describe("readFoodNames", () => {
  it("lee solo los tipos importables", async () => {
    const names = await readFoodNames(join(FIXTURES, "fdc"));
    expect(names.map((n) => n.fdcId)).toEqual(["100", "200", "201"]);
  });
});

describe("readDataset", () => {
  it("Foundation / SR Legacy: nutrientes por id, porciones y categoría", async () => {
    const foods = await readDataset(join(FIXTURES, "fdc"));
    expect(foods.map((f) => f.fdcId)).toEqual(["100", "200", "201"]);

    const chicken = normalizeFood(foods[0], "Pollo, pechuga, crudo");
    expect(chicken).toMatchObject({
      ok: true,
      food: {
        source: "usda_fdc",
        state: "crudo",
        category: "Aves",
        nutrients: { energy_kcal: 118, protein_g: 22.5, fat_g: 1.93, sodium_mg: 45 },
        // La porción "paired raw w" no es casera y se descarta.
        portions: [{ sourcePortionId: "10", labelEs: "1 pechuga", grams: 174 }],
      },
    });

    const rice = normalizeFood(foods[1], "Arroz blanco cocido");
    expect(rice).toMatchObject({
      ok: true,
      food: {
        state: "cocido",
        category: "Cereales y pastas",
        nutrients: { energy_kcal: 130.019, carb_g: 28.17 },
        // Ordenadas por seq_num.
        portions: [
          { sourcePortionId: "21", labelEs: "0,5 taza", grams: 79 },
          { sourcePortionId: "20", labelEs: "1 taza", grams: 158 },
        ],
      },
    });

    expect(normalizeFood(foods[2], "Especias")).toMatchObject({
      ok: false,
      reason: "sin_energia",
    });
  });

  it("FNDDS: nutrientes por número, categoría WWEIA y porciones caseras", async () => {
    const [milk] = await readDataset(join(FIXTURES, "fndds"));
    expect(normalizeFood(milk, "Leche entera")).toEqual({
      ok: true,
      food: {
        source: "usda_fndds",
        sourceId: "300",
        nameEs: "Leche entera",
        nameEn: "Milk, whole",
        category: "Leche entera",
        kcalCalculada: false,
        portionsSinTraducir: [],
        state: "na",
        basis: "per_100g",
        license: "CC0 / dominio público",
        nutrients: {
          energy_kcal: 60,
          protein_g: 3.27,
          carb_g: 4.67,
          sugar_g: 4.81,
          fat_g: 3.2,
          sodium_mg: 38,
        },
        portions: [
          { sourcePortionId: "30", labelEs: "1 taza", grams: 244 },
          { sourcePortionId: "31", labelEs: "1 onza líquida", grams: 30.5 },
        ],
      },
    });
  });
});
