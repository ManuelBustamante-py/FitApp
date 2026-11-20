import { describe, expect, it } from "vitest";

import { CATEGORIAS_WWEIA } from "../usda/categorias.ts";

import {
  categoriaDeEtiqueta,
  MAPEO_CATEGORIAS_OFF,
  normalizarEtiqueta,
  resolverCategoria,
  SIN_CATEGORIA,
} from "./categorias.ts";

describe("mapeo de categorías de Open Food Facts", () => {
  it("todas las claves del mapeo existen en las categorías USDA (no se inventan categorías)", () => {
    const faltantes = Object.entries(MAPEO_CATEGORIAS_OFF).filter(
      ([, clave]) => !(clave in CATEGORIAS_WWEIA),
    );
    expect(faltantes).toEqual([]);
  });

  it("las etiquetas del mapeo están en minúsculas y sin prefijo de idioma", () => {
    for (const tag of Object.keys(MAPEO_CATEGORIAS_OFF)) {
      expect(tag).toBe(normalizarEtiqueta(tag));
      expect(tag).not.toContain(":");
    }
  });

  it("cubre las familias comunes de productos envasados", () => {
    const esperadas: Record<string, string> = {
      "en:sodas": "Bebidas gaseosas",
      "en:yogurts": "Yogur regular",
      "en:cheeses": "Queso",
      "en:biscuits": "Galletas y brownies",
      "en:breakfast-cereals":
        "Cereales listos para comer, alto en azúcar (>21,2 g/100 g)",
      "en:breads": "Panes de levadura",
      "en:sausages": "Longanizas y embutidos",
      "en:canned-tunas": "Pescados",
      "en:tomato-sauces": "Salsas de tomate para pasta",
      "en:chocolates": "Golosinas con chocolate",
      "en:frozen-pizzas": "Pizza",
      "en:potato-chips": "Papas fritas de bolsa",
    };
    for (const [tag, categoria] of Object.entries(esperadas)) {
      expect(categoriaDeEtiqueta(tag)).toBe(categoria);
    }
  });
});

describe("resolverCategoria", () => {
  it("elige la etiqueta más específica (última) con mapeo", () => {
    expect(
      resolverCategoria(["en:beverages", "en:sodas", "en:diet-sodas", "en:sin-mapeo"])
        .category,
    ).toBe("Bebidas gaseosas light");
  });

  it("main_category tiene prioridad", () => {
    expect(resolverCategoria(["en:cheeses"], "en:yogurts").category).toBe(
      "Yogur regular",
    );
  });

  it("sin coincidencia devuelve Sin categoría y las etiquetas sin mapear", () => {
    expect(resolverCategoria(["en:snacks", "EN:Cosa-Rara", "en:snacks"])).toEqual({
      category: SIN_CATEGORIA,
      sinMapear: ["snacks", "cosa-rara"],
    });
    expect(resolverCategoria([])).toEqual({ category: SIN_CATEGORIA, sinMapear: [] });
  });
});
