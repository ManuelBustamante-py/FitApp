import { describe, expect, it } from "vitest";

import { pluralizeEs, splitSegments, translateName } from "./translate.ts";

describe("splitSegments", () => {
  it("divide por comas fuera de paréntesis", () => {
    expect(splitSegments("Artichokes, (globe or french), frozen")).toEqual([
      "Artichokes",
      "(globe or french)",
      "frozen",
    ]);
    expect(splitSegments("Cheese (Includes foods, etc), raw")).toEqual([
      "Cheese (Includes foods, etc)",
      "raw",
    ]);
  });
});

describe("translateName", () => {
  it.each([
    ["Chicken, broiler, breast, meat only, raw", "Pollo, pechuga, solo carne, crudo"],
    [
      "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw",
      "Pollo, pechuga, sin piel, sin hueso, solo carne, crudo",
    ],
    [
      "Rice, white, long-grain, regular, cooked",
      "Arroz, blanco, grano largo, normal, cocido",
    ],
    ["Chicken breast, baked", "Pechuga de pollo, horneado"],
    ["Kidney beans and brown rice", "Porotos rojos y arroz integral"],
    ["Milk, whole", "Leche, entero"],
    ["Fried chicken", "Pollo frito"],
    ["Apples, raw, with skin", "Manzanas, crudo, con piel"],
    [
      'Beef, round, separable lean only, trimmed to 1/8" fat, choice, cooked',
      'Vacuno, pierna, solo magro, recortado a 1/8" de grasa, choice, cocido',
    ],
    ["Tea, NS as to type", "Té, tipo sin especificar"],
    ["Coffee, NS as to brand", "Café, [brand] sin especificar"],
  ])("%s → %s", (en, es) => {
    expect(translateName(en).text).toBe(es);
  });

  it("usa el plural español si el glosario solo tiene el singular", () => {
    expect(translateName("Pies, frozen").text).toBe("Pies, congelado");
    expect(translateName("Lemons, raw").text).toBe("Limones, crudo");
    expect(pluralizeEs("pera")).toBe("peras");
    expect(pluralizeEs("lápiz")).toBe("lápices");
    expect(pluralizeEs("melón")).toBe("melones");
    expect(pluralizeEs("pan")).toBe("panes");
    expect(pluralizeEs("arroz integral")).toBe("arroz integral");
  });

  it("marca las palabras sin glosario y no da la traducción por completa", () => {
    const result = translateName("Kumquats, raw");
    expect(result).toEqual({
      text: "[kumquats], crudo",
      complete: false,
      missing: ["kumquats"],
    });
  });

  it("es determinista", () => {
    const name = "Beverages, coffee, brewed, prepared with tap water, decaffeinated";
    expect(translateName(name)).toEqual(translateName(name));
  });
});
