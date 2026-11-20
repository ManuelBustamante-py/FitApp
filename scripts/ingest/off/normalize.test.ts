import { describe, expect, it } from "vitest";

import {
  CHILE_TAG,
  LATAM_COUNTRY_TAGS,
  processProduct,
  type OffRawProduct,
} from "./normalize.ts";

const CHILE = new Set([CHILE_TAG]);

function product(overrides: Partial<OffRawProduct> = {}): OffRawProduct {
  return {
    code: "7801234567890",
    productName: "Cookies",
    productNameEs: "Galletas",
    brands: "Marca A, Marca B",
    quantity: "200 g",
    countriesTags: ["en:chile"],
    nutriments: {
      "energy-kcal_100g": 480,
      proteins_100g: 6,
      fat_100g: 20,
      carbohydrates_100g: 68,
    },
    ...overrides,
  };
}

function invalidReason(raw: OffRawProduct, countries = CHILE) {
  const result = processProduct(raw, { countries });
  expect(result.kind).toBe("invalido");
  return result.kind === "invalido" ? result.reason : null;
}

describe("processProduct", () => {
  it("importa un producto válido con código de barras, marca y nutrientes", () => {
    const result = processProduct(product(), { countries: CHILE });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.food).toMatchObject({
      barcode: "7801234567890",
      nameEs: "Galletas",
      brand: "Marca A",
      basis: "per_100g",
      kcalDesdeKj: false,
    });
    expect(result.food.nutrients).toEqual({
      energy_kcal: 480,
      protein_g: 6,
      fat_g: 20,
      carb_g: 68,
    });
  });

  describe("filtro de país", () => {
    it("ignora productos de otros países", () => {
      const raw = product({ countriesTags: ["en:france"] });
      expect(processProduct(raw, { countries: CHILE })).toEqual({
        kind: "fuera_de_pais",
      });
    });

    it("acepta si alguno de los países coincide", () => {
      const raw = product({ countriesTags: ["en:argentina", "en:chile"] });
      expect(processProduct(raw, { countries: CHILE }).kind).toBe("ok");
    });

    it("la lista LatAm es configurable", () => {
      const raw = product({ countriesTags: ["en:mexico"] });
      expect(processProduct(raw, { countries: CHILE }).kind).toBe("fuera_de_pais");
      expect(processProduct(raw, { countries: new Set(LATAM_COUNTRY_TAGS) }).kind).toBe(
        "ok",
      );
    });

    it("el país se evalúa antes que la validación", () => {
      const raw = product({ code: "x", countriesTags: ["en:france"] });
      expect(processProduct(raw, { countries: CHILE }).kind).toBe("fuera_de_pais");
    });
  });

  describe("nombre", () => {
    it("prefiere product_name_es y cae a product_name", () => {
      const es = processProduct(product(), { countries: CHILE });
      const fallback = processProduct(product({ productNameEs: "  " }), {
        countries: CHILE,
      });
      expect(es.kind === "ok" && es.food.nameEs).toBe("Galletas");
      expect(fallback.kind === "ok" && fallback.food.nameEs).toBe("Cookies");
    });

    it("descarta sin nombre", () => {
      expect(invalidReason(product({ productName: "", productNameEs: " " }))).toBe(
        "sin_nombre",
      );
    });

    it("recorta a 200 caracteres y colapsa espacios", () => {
      const result = processProduct(product({ productNameEs: "a  b".padEnd(300, "x") }), {
        countries: CHILE,
      });
      expect(result.kind === "ok" && result.food.nameEs).toHaveLength(200);
      expect(result.kind === "ok" && result.food.nameEs.startsWith("a b")).toBe(true);
    });
  });

  describe("código de barras", () => {
    it.each(["", "abc", "12345", "123456789012345", "78012 34567"])(
      "descarta código inválido %j",
      (code) => {
        expect(invalidReason(product({ code }))).toBe("sin_codigo_barras");
      },
    );

    it("conserva ceros a la izquierda", () => {
      const result = processProduct(product({ code: "0012345678905" }), {
        countries: CHILE,
      });
      expect(result.kind === "ok" && result.food.barcode).toBe("0012345678905");
    });
  });

  describe("energía", () => {
    it("convierte kJ a kcal (÷ 4,184) cuando faltan las kcal", () => {
      const raw = product({ nutriments: { "energy-kj_100g": 1674 } });
      const result = processProduct(raw, { countries: CHILE });
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;
      expect(result.food.nutrients.energy_kcal).toBe(400.1);
      expect(result.food.kcalDesdeKj).toBe(true);
    });

    it("acepta energy_100g como kJ", () => {
      const result = processProduct(product({ nutriments: { energy_100g: 418.4 } }), {
        countries: CHILE,
      });
      expect(result.kind === "ok" && result.food.nutrients.energy_kcal).toBe(100);
    });

    it("prefiere las kcal informadas sobre los kJ", () => {
      const raw = product({
        nutriments: { "energy-kcal_100g": 100, "energy-kj_100g": 9999 },
      });
      const result = processProduct(raw, { countries: CHILE });
      expect(result.kind === "ok" && result.food.nutrients.energy_kcal).toBe(100);
    });

    it("descarta sin energía", () => {
      expect(invalidReason(product({ nutriments: { proteins_100g: 5 } }))).toBe(
        "sin_energia",
      );
    });

    it("acepta 900 kcal y descarta más de 900", () => {
      expect(
        processProduct(product({ nutriments: { "energy-kcal_100g": 900 } }), {
          countries: CHILE,
        }).kind,
      ).toBe("ok");
      expect(invalidReason(product({ nutriments: { "energy-kcal_100g": 900.1 } }))).toBe(
        "kcal_fuera_de_rango",
      );
    });

    it("valida el rango también sobre los kcal derivados de kJ", () => {
      expect(invalidReason(product({ nutriments: { "energy-kj_100g": 4000 } }))).toBe(
        "kcal_fuera_de_rango",
      );
    });

    it("descarta kcal negativas", () => {
      expect(invalidReason(product({ nutriments: { "energy-kcal_100g": -1 } }))).toBe(
        "kcal_fuera_de_rango",
      );
    });
  });

  describe("macros", () => {
    const base = { "energy-kcal_100g": 100 };

    it.each([
      ["proteins_100g", 100.5],
      ["fat_100g", 101],
      ["carbohydrates_100g", 150],
      ["sugars_100g", 120],
      ["fiber_100g", 101],
      ["salt_100g", 101],
      ["proteins_100g", -1],
    ])("descarta %s = %d", (key, value) => {
      expect(invalidReason(product({ nutriments: { ...base, [key]: value } }))).toBe(
        "nutriente_fuera_de_rango",
      );
    });

    it("acepta 100 g y 0 g", () => {
      const raw = product({
        nutriments: { ...base, carbohydrates_100g: 100, fiber_100g: 0 },
      });
      expect(processProduct(raw, { countries: CHILE }).kind).toBe("ok");
    });

    it("descarta si proteínas + grasas + carbohidratos superan 105 g", () => {
      const raw = product({
        nutriments: { ...base, proteins_100g: 40, fat_100g: 40, carbohydrates_100g: 40 },
      });
      expect(invalidReason(raw)).toBe("macros_suman_mas_de_100");
    });

    it("descarta valores no numéricos", () => {
      expect(invalidReason(product({ nutriments: { ...base, fat_100g: NaN } }))).toBe(
        "valor_no_numerico",
      );
    });

    it("convierte sodio y colesterol de g a mg, y deriva el sodio de la sal", () => {
      const withSodium = processProduct(
        product({
          nutriments: { ...base, sodium_100g: 0.5, cholesterol_100g: 0.03, salt_100g: 9 },
        }),
        { countries: CHILE },
      );
      expect(withSodium.kind === "ok" && withSodium.food.nutrients).toMatchObject({
        sodium_mg: 500,
        cholesterol_mg: 30,
      });
      const withSalt = processProduct(
        product({ nutriments: { ...base, salt_100g: 1.5 } }),
        {
          countries: CHILE,
        },
      );
      expect(withSalt.kind === "ok" && withSalt.food.nutrients.sodium_mg).toBe(600);
    });
  });

  it("marca como per_100ml los líquidos", () => {
    for (const quantity of ["1 l", "500 ml", "1,5 L", "33 cl"]) {
      const result = processProduct(product({ quantity }), { countries: CHILE });
      expect(result.kind === "ok" && result.food.basis).toBe("per_100ml");
    }
    const solid = processProduct(product({ quantity: "250 g" }), { countries: CHILE });
    expect(solid.kind === "ok" && solid.food.basis).toBe("per_100g");
  });

  it("brand es null si no hay marcas", () => {
    const result = processProduct(product({ brands: "" }), { countries: CHILE });
    expect(result.kind === "ok" && result.food.brand).toBeNull();
  });
});
