import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FoodSearchResult } from "@/lib/food/search-queries";

import { ResultadoAlimento } from "./resultado-alimento";

const base: FoodSearchResult = {
  id: "1",
  name_es: "Leche descremada",
  name_en: null,
  brand: "Soprole",
  category: "Lácteos",
  source: "off",
  basis: "per_100ml",
  barcode: "7802900000000",
  owner_user_id: null,
  kcal_per_100: 35.4,
  score: 1,
};

const render = (food: FoodSearchResult) =>
  renderToStaticMarkup(
    createElement("ul", null, createElement(ResultadoAlimento, { food })),
  );

describe("ResultadoAlimento", () => {
  it("enlaza al registro del alimento", () => {
    expect(render(base)).toContain('href="/alimentos/1"');
  });

  it("muestra nombre, marca, categoría, kcal, base y fuente", () => {
    const html = render(base);
    expect(html).toContain("Leche descremada");
    expect(html).toContain("Soprole · Lácteos");
    expect(html).toContain("35");
    expect(html).toContain("por 100 ml");
    expect(html).toContain("Fuente: Open Food Facts.");
  });

  it("indica Sin dato si no hay kcal y omite detalles vacíos", () => {
    const html = render({
      ...base,
      brand: null,
      category: null,
      kcal_per_100: null,
      basis: "per_100g",
      source: "usda_fdc",
    });
    expect(html).toContain("Sin dato");
    expect(html).toContain("por 100 g");
    expect(html).not.toContain("Soprole");
  });
});
