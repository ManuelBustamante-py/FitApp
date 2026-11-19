import { describe, expect, it } from "vitest";

import {
  agreementOf,
  inflectAdjective,
  pluralizeEs,
  splitSegments,
  translateFragment,
  translateName,
} from "./translate.ts";

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
    ["Chicken breast, baked", "Pechuga de pollo, horneada"],
    ["Kidney beans and brown rice", "Porotos rojos y arroz integral"],
    ["Fried chicken", "Pollo frito"],
    [
      'Beef, round, separable lean only, trimmed to 1/8" fat, choice, cooked',
      'Vacuno, pierna, solo magro, recortado a 1/8" de grasa, choice, cocido',
    ],
    ["Tea, NS as to type", "Té, tipo sin especificar"],
    ["Coffee, NS as to brand", "Café, marca sin especificar"],
  ])("%s → %s", (en, es) => {
    expect(translateName(en).text).toBe(es);
  });

  describe("concordancia de género y número", () => {
    it.each([
      ["Potatoes, raw", "Papas, crudas"],
      ["Apples, raw, with skin", "Manzanas, crudas, con cáscara"],
      ["Milk, whole", "Leche, entera"],
      ["Carrots, frozen, cooked with oil", "Zanahorias, congeladas, cocidas con aceite"],
      ["Onions, cooked, no added fat", "Cebollas, cocidas, sin grasa agregada"],
      [
        "Beans, kidney, canned, low sodium",
        "Porotos, riñón, en conserva, bajos en sodio",
      ],
      ["Okra, frozen, unprepared", "Okra, congelada, sin preparar"],
      ["Pork chop, baked or broiled", "Chuleta de cerdo, horneada o asada"],
      ["Spinach, canned, drained", "Espinaca, en conserva, escurrida"],
      ["Peanut butter, creamy", "Mantequilla de maní, cremosa"],
      [
        "Stuffed grape leaves with lamb and rice",
        "Hojas de uva rellenas con cordero y arroz",
      ],
    ])("%s → %s", (en, es) => {
      expect(translateName(en).text).toBe(es);
    });

    it("el modificador toma el género y número del sustantivo núcleo", () => {
      expect(translateName("Fried potatoes").text).toBe("Papas fritas");
      expect(translateName("Dried apricots").text).toBe("Damascos secos");
      expect(translateName("Dried peaches").text).toBe("Duraznos secos");
      expect(translateName("Chopped onion").text).toBe("Cebolla picada");
    });

    it("un genérico inicial deja que mande el siguiente sustantivo", () => {
      expect(translateName("Snacks, potato chips, white").text).toMatch(/blancas?$/);
    });

    it("agreementOf infiere género y número del núcleo español", () => {
      expect(agreementOf("papas")).toEqual({ gender: "f", plural: true });
      expect(agreementOf("pechuga de pollo")).toEqual({ gender: "f", plural: false });
      expect(agreementOf("arroz")).toEqual({ gender: "m", plural: false });
      expect(agreementOf("leche")).toEqual({ gender: "f", plural: false });
      expect(agreementOf("porotos")).toEqual({ gender: "m", plural: true });
      expect(agreementOf("cuscús")).toEqual({ gender: "m", plural: false });
      expect(agreementOf("porción")).toEqual({ gender: "f", plural: false });
    });

    it("inflectAdjective flexiona solo lo que corresponde", () => {
      const fp = { gender: "f", plural: true } as const;
      const ms = { gender: "m", plural: false } as const;
      expect(inflectAdjective("crudo", fp)).toBe("crudas");
      expect(inflectAdjective("integral", fp)).toBe("integrales");
      expect(inflectAdjective("bajo en grasa", { gender: "f", plural: false })).toBe(
        "baja en grasa",
      );
      expect(inflectAdjective("sin sal", fp)).toBe("sin sal");
      expect(inflectAdjective("ligeramente salado", fp)).toBe("ligeramente saladas");
      expect(inflectAdjective("light", fp)).toBe("light");
      expect(inflectAdjective("crudo", ms)).toBe("crudo");
    });
  });

  it("usa el plural español si el glosario solo tiene el singular", () => {
    expect(translateName("Pies, frozen").text).toBe("Pies, congelados");
    expect(translateName("Lemons, raw").text).toBe("Limones, crudos");
    expect(pluralizeEs("pera")).toBe("peras");
    expect(pluralizeEs("lápiz")).toBe("lápices");
    expect(pluralizeEs("melón")).toBe("melones");
    expect(pluralizeEs("pan")).toBe("panes");
    expect(pluralizeEs("arroz integral")).toBe("arroz integral");
  });

  it("deja las marcas y los nombres propios sin traducir sin marcarlos como faltantes", () => {
    expect(translateName("Cereals ready-to-eat, QUAKER, Cap'n Crunch").complete).toBe(
      true,
    );
    expect(translateName("Candies, KRACKEL Chocolate Bar").text).toContain("Krackel");
    expect(translateName("Tamales (Navajo)").text).toBe("Tamales (Navajo)");
  });

  it("traduce los sufijos -based, -flavored y -coated con su sustantivo", () => {
    expect(translateName("Sauce, tomato-based").text).toBe("Salsa, a base de tomate");
    expect(translateName("Popcorn, butter flavored").text).toContain(
      "sabor a mantequilla",
    );
    expect(translateName("Ice cream bar, chocolate coated").text).toContain(
      "cubierta de chocolate",
    );
  });

  describe("contexto del alimento y retoques finales", () => {
    it.each([
      ["Peppers, hot, raw", "Ají, crudo"],
      ["Peppers, hot chili, green, raw", "Ají, verde, crudo"],
      ["Peppers, banana, raw", "Pimentones, plátano, crudos"],
      ["Hot chocolate / cocoa, NFS", "Chocolate caliente, sin especificar"],
      ["Sauce, hot chile, sriracha", "Salsa, ají picante, sriracha"],
      ["Potatoes, russet, flesh and skin, raw", "Papas, russet, pulpa y cáscara, crudas"],
      ["Apples, raw, with skin", "Manzanas, crudas, con cáscara"],
      ["Chicken, thigh, meat and skin, raw", "Pollo, trutro largo, carne y piel, crudo"],
      ["Chicken, breast, with skin, raw", "Pollo, pechuga, con piel, crudo"],
      ["Milk, whole, 3.25% milkfat", "Leche, entera, 3,25 % de materia grasa"],
      ["Snacks, banana chips", "Snacks, chips de plátano"],
      ["Snacks, potato chips, plain", "Snacks, papas fritas, naturales"],
      ["Cereal, other, chocolate", "Cereal de chocolate, otro"],
      ["Cereal, other, plain", "Cereal natural, otro"],
      [
        "Milk, dry, nonfat, regular, without added vitamin A and vitamin D",
        "Leche, seca, descremada, normal, sin vitaminas A y D agregadas",
      ],
    ])("%s → %s", (en, es) => {
      expect(translateName(en).text).toBe(es);
    });
  });

  it("convierte los grados 'proof' en porcentaje de alcohol", () => {
    expect(translateName("Alcoholic beverage, distilled, rum, 80 proof").text).toContain(
      "40 % de alcohol",
    );
  });

  it("marca las palabras sin glosario y no da la traducción por completa", () => {
    const result = translateName("Frobnicates, raw");
    expect(result).toEqual({
      text: "[frobnicates], crudos",
      complete: false,
      missing: ["frobnicates"],
    });
  });

  it("es determinista", () => {
    const name = "Beverages, coffee, brewed, prepared with tap water, decaffeinated";
    expect(translateName(name)).toEqual(translateName(name));
  });
});

describe("translateFragment", () => {
  it("traduce un fragmento con el glosario y concuerda con el último sustantivo", () => {
    expect(translateFragment("slice, thin").text).toBe("rebanada, delgada");
    expect(translateFragment("zzz").missing).toEqual(["zzz"]);
  });
});
