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

  it("etiquetas en español: misma categoría que su par en inglés", () => {
    const pares: [string, string][] = [
      ["es:galletas", "en:biscuits"],
      ["es:yogures", "en:yogurts"],
      ["es:leches", "en:milks"],
      ["es:quesos", "en:cheeses"],
      ["es:pan", "en:breads"],
      ["es:leches-saborizadas", "en:flavoured-milks"],
      ["es:jugos-de-fruta", "en:fruit-juices"],
    ];
    for (const [es, en] of pares) {
      expect(categoriaDeEtiqueta(es)).not.toBeNull();
      expect(categoriaDeEtiqueta(es)).toBe(categoriaDeEtiqueta(en));
    }
    expect(categoriaDeEtiqueta("es:yogures")).toBe("Yogur regular");
    expect(categoriaDeEtiqueta("es:galletas")).toBe("Galletas y brownies");
  });

  it("etiquetas en español con espacios, mayúsculas o tildes", () => {
    expect(categoriaDeEtiqueta("es:leches saborizadas")).toBe(
      categoriaDeEtiqueta("en:flavoured-milks"),
    );
    expect(categoriaDeEtiqueta("Jugos de Fruta")).toBe("Otros jugos de fruta");
    expect(categoriaDeEtiqueta("es:Dulces Untables")).toBe(
      "Mermeladas, jarabes y coberturas",
    );
    expect(categoriaDeEtiqueta("es:dulces únicos")).toBeNull();
    expect(categoriaDeEtiqueta("es:quésos")).toBe("Queso");
  });

  it("las etiquetas genéricas en español no se mapean", () => {
    const genericas = [
      "es:bebidas",
      "es:lácteos",
      "es:lacteos",
      "es:postres",
      "es:snacks",
      "es:carnes",
      "es:cereales",
      "es:alimentos",
    ];
    for (const tag of genericas) {
      expect(categoriaDeEtiqueta(tag), tag).toBeNull();
    }
    expect(resolverCategoria(["es:bebidas", "es:galletas"]).category).toBe(
      "Galletas y brownies",
    );
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
