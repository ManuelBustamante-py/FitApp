import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readCsvRecords } from "../lib/csv.ts";

import { CATEGORIAS_WWEIA } from "./categorias.ts";
import { categoryEs } from "./normalize.ts";

const here = dirname(fileURLToPath(import.meta.url));

async function descriptions(path: string): Promise<string[]> {
  const out: string[] = [];
  for await (const r of readCsvRecords(path)) out.push(r.wweia_food_category_description);
  return out;
}

describe("categorías WWEIA", () => {
  it("las categorías de los datos de ejemplo están traducidas", async () => {
    const list = await descriptions(
      join(here, "__fixtures__", "fndds", "wweia_food_category.csv"),
    );
    expect(list.length).toBeGreaterThan(0);
    for (const description of list) {
      expect(CATEGORIAS_WWEIA[description], description).toBeTruthy();
      expect(categoryEs(description)).toBe(CATEGORIAS_WWEIA[description]);
    }
  });

  it("todas las categorías de la descarga real (si existe) están traducidas", async () => {
    const root = join(here, "..", "data", "usda");
    if (!existsSync(root)) return;
    for (const dir of readdirSync(root).filter((d) => d.includes("survey"))) {
      const file = join(root, dir, "wweia_food_category.csv");
      if (!existsSync(file)) continue;
      const list = await descriptions(file);
      expect(list.length).toBeGreaterThan(100);
      expect(list.filter((d) => !CATEGORIAS_WWEIA[d])).toEqual([]);
    }
  });

  it("no hay traducciones vacías ni repetidas", () => {
    const values = Object.values(CATEGORIAS_WWEIA);
    expect(values.every((v) => v.trim() !== "")).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
