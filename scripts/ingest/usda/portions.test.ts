import { describe, expect, it } from "vitest";

import {
  buildPortionLabelEn,
  normalizePortions,
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
    ["0.5 cup", "0.5 taza"],
    ["3 oz", "3 onzas"],
    ["1 fl oz", "1 onza líquida"],
    ["8 fl oz", "8 onzas líquidas"],
    ["1 cup, chopped", "1 taza, picado"],
    ["1 medium", "1 unidad mediana"],
    ["2 large", "2 unidades grandes"],
    ['1 small (6-1/2" long)', '1 unidad pequeña (6-1/2" de largo)'],
    ["1 large or thick slice", "1 rebanada grande o grueso"],
    ['1 medium pizza (11-12" diameter)', '1 pizza mediano (11-12" de diámetro)'],
    ["1 slice", "1 rebanada"],
    ["1 serving", "1 porción"],
    ["1 cubic inch", "1 pulgada cúbica"],
    ["1 fl oz (no ice)", "1 onza líquida (sin hielo)"],
    ["1 cup (8 fl oz)", "1 taza (8 onza líquida)"],
    ["1 RACC", "1 porción de referencia"],
  ])("%s → %s", (en, es) => {
    expect(translatePortionLabel(en)).toBe(es);
  });

  it("conserva las palabras sin regla y limita el largo a 80 caracteres", () => {
    expect(translatePortionLabel("1 jar Gerber Second Food (4 oz)")).toBe(
      "1 frasco Gerber Second Food (4 onza)",
    );
    const long = translatePortionLabel(`1 cup ${"word ".repeat(30)}`);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("…")).toBe(true);
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
    expect(result).toEqual([
      { sourcePortionId: "1", labelEs: "1 taza", grams: 244.04 },
      { sourcePortionId: "5", labelEs: "1 cucharada", grams: 15.26 },
    ]);
  });
});
