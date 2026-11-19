import { describe, expect, it } from "vitest";

import {
  buildPortionLabelEn,
  normalizePortions,
  translatePortion,
  translatePortionLabel,
  type UsdaPortionRow,
} from "./portions.ts";

const row = (over: Partial<UsdaPortionRow>): UsdaPortionRow => ({
  id: "1",
  amount: "",
  measureUnitName: "",
  portionDescription: "",
  modifier: "",
  gramWeight: "100",
  ...over,
});

describe("buildPortionLabelEn", () => {
  it("FNDDS usa portion_description e ignora el modifier numérico", () => {
    expect(
      buildPortionLabelEn(row({ portionDescription: "1 cup", modifier: "10205" })),
    ).toBe("1 cup");
  });

  it("SR Legacy combina cantidad y modifier (unidad 9999)", () => {
    expect(
      buildPortionLabelEn(
        row({ amount: "1", measureUnitName: "undetermined", modifier: "cup, chopped" }),
      ),
    ).toBe("1 cup, chopped");
  });

  it("Foundation combina cantidad, unidad y modifier", () => {
    expect(
      buildPortionLabelEn(
        row({ amount: "2.0", measureUnitName: "tablespoon", modifier: "" }),
      ),
    ).toBe("2 tablespoon");
    expect(
      buildPortionLabelEn(
        row({ amount: "1.0", measureUnitName: "egg", modifier: "yolk" }),
      ),
    ).toBe("1 egg, yolk");
  });

  it("descarta porciones no caseras o sin descripción", () => {
    expect(
      buildPortionLabelEn(row({ portionDescription: "Quantity not specified" })),
    ).toBe(null);
    expect(
      buildPortionLabelEn(row({ portionDescription: "Guideline amount per fl oz" })),
    ).toBe(null);
    expect(
      buildPortionLabelEn(row({ amount: "1", measureUnitName: "paired raw w" })),
    ).toBe(null);
    expect(
      buildPortionLabelEn(row({ amount: "1", measureUnitName: "undetermined" })),
    ).toBe(null);
  });
});

describe("translatePortionLabel", () => {
  it.each([
    ["1 cup", "1 taza"],
    ["2 cups", "2 tazas"],
    ["1 tbsp", "1 cucharada"],
    ["3 tablespoons", "3 cucharadas"],
    ["1 tsp", "1 cucharadita"],
    ["1/2 cup", "1/2 taza"],
    ["0.5 cup", "0,5 taza"],
    ["1.5 oz", "1,5 onzas"],
    ["3 oz", "3 onzas"],
    ["1 fl oz", "1 onza líquida"],
    ["8 fl oz", "8 onzas líquidas"],
    ["1 cup, chopped", "1 taza, picada"],
    ["2 cups, chopped", "2 tazas, picadas"],
    ["1 medium", "1 unidad mediana"],
    ["2 large", "2 unidades grandes"],
    ['1 small (6-1/2" long)', '1 unidad pequeña (6-1/2" de largo)'],
    ["1 large or thick slice", "1 rebanada grande o gruesa"],
    ['1 medium pizza (11-12" diameter)', '1 pizza mediana (11-12" de diámetro)'],
    ["1 medium egg", "1 huevo mediano"],
    ["1 slice", "1 rebanada"],
    ["1 serving", "1 porción"],
    ["1 cubic inch", "1 pulgada cúbica"],
    ["1 fl oz (no ice)", "1 onza líquida (sin hielo)"],
    ["1 cup (8 fl oz)", "1 taza (8 onzas líquidas)"],
    ["1 package (12 oz)", "1 paquete (12 onzas)"],
    ["1 RACC", "1 porción de referencia"],
    ["1 egg, NS as to size", "1 huevo, tamaño sin especificar"],
    ["3 heaping tsp", "3 cucharaditas colmadas"],
  ])("%s → %s", (en, es) => {
    expect(translatePortionLabel(en)).toBe(es);
  });

  it("traduce las unidades y deja las marcas como nombres propios", () => {
    expect(translatePortionLabel("1 jar Gerber Second Food (4 oz)")).toBe(
      "1 frasco Gerber Second Food (4 onzas)",
    );
    expect(translatePortionLabel("1 bottle Earth's Best (4.2 fl oz)")).toBe(
      "1 botella Earth's Best (4,2 onzas líquidas)",
    );
    expect(translatePortion("1 Taco Bell taco salad")).toEqual({
      text: "1 Taco Bell ensalada de taco",
      missing: [],
    });
  });

  it("informa las palabras que no logra traducir", () => {
    const result = translatePortion("1 cup frobnicated");
    expect(result.missing).toEqual(["frobnicated"]);
    expect(result.text).toContain("[frobnicated]");
  });
});

describe("normalizePortions", () => {
  it("filtra gramos inválidos, traduce y elimina etiquetas repetidas", () => {
    const result = normalizePortions([
      row({ id: "1", portionDescription: "1 cup", gramWeight: "244.04" }),
      row({ id: "2", portionDescription: "Quantity not specified", gramWeight: "0" }),
      row({ id: "3", portionDescription: "1 cup", gramWeight: "240" }),
      row({ id: "4", portionDescription: "1 fl oz", gramWeight: "abc" }),
      row({ id: "5", portionDescription: "1 tablespoon", gramWeight: "15.256" }),
    ]);
    expect(result).toEqual({
      portions: [
        { sourcePortionId: "1", labelEs: "1 taza", grams: 244.04 },
        { sourcePortionId: "5", labelEs: "1 cucharada", grams: 15.26 },
      ],
      untranslated: [],
    });
  });

  it("descarta y reporta las etiquetas que no quedan totalmente en español", () => {
    const result = normalizePortions([
      row({ id: "1", portionDescription: "1 cup frobnicated", gramWeight: "100" }),
      row({ id: "2", portionDescription: "1 slice", gramWeight: "30" }),
    ]);
    expect(result.portions).toEqual([
      { sourcePortionId: "2", labelEs: "1 rebanada", grams: 30 },
    ]);
    expect(result.untranslated).toEqual(["1 cup frobnicated"]);
  });

  it("acorta quitando aclaraciones finales entre paréntesis y descarta si aun así no cabe", () => {
    const short = normalizePortions([
      row({
        id: "1",
        portionDescription:
          "1 small thigh (from hen, approx 11 to 13 lb bird) (yield after cooking, bone and skin removed)",
        gramWeight: "50",
      }),
    ]);
    expect(short.portions).toHaveLength(1);
    expect(short.portions[0].labelEs.length).toBeLessThanOrEqual(80);
    const long = normalizePortions([
      row({
        id: "2",
        portionDescription: `1 cup ${"slice ".repeat(20)}`,
        gramWeight: "50",
      }),
    ]);
    expect(long.portions).toEqual([]);
    expect(long.untranslated).toHaveLength(1);
  });
});

describe("cobertura sobre las etiquetas reales de USDA", () => {
  it("no deja palabras sin traducir en las porciones de la descarga (si existe)", async () => {
    const { existsSync } = await import("node:fs");
    const { findDatasetDirs, readDataset } = await import("./dataset.ts");
    const { fileURLToPath } = await import("node:url");
    const { join, dirname } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "usda");
    if (!existsSync(root)) return;
    const missing = new Set<string>();
    for (const dir of findDatasetDirs(root)) {
      for (const food of await readDataset(dir)) {
        for (const p of food.portions) {
          const label = buildPortionLabelEn(p);
          if (label) for (const w of translatePortion(label).missing) missing.add(w);
        }
      }
    }
    expect([...missing]).toEqual([]);
  }, 120_000);
});
