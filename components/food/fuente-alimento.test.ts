import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getSourceInfo, ODBL_URL, OFF_URL } from "@/lib/food/attribution";

import { FuenteAlimento } from "./fuente-alimento";

const render = (source: string) =>
  renderToStaticMarkup(createElement(FuenteAlimento, { source }));

describe("FuenteAlimento", () => {
  it("muestra atribución ODbL y enlaces para Open Food Facts", () => {
    const html = render("off");
    expect(html).toContain("Fuente: Open Food Facts.");
    expect(html).toContain("Open Database License (ODbL)");
    expect(html).toContain(`href="${ODBL_URL}"`);
    expect(html).toContain(`href="${OFF_URL}"`);
    expect(html).toContain('href="/fuentes"');
    expect(html).toContain("Licencia ODbL 1.0");
  });

  it("para USDA no muestra enlaces ODbL pero sí los créditos", () => {
    const html = render("usda_fdc");
    expect(html).toContain("Fuente: USDA FoodData Central.");
    expect(html).not.toContain(ODBL_URL);
    expect(html).toContain('href="/fuentes"');
  });

  it("los alimentos propios del usuario tienen etiqueta legible", () => {
    expect(render("user")).toContain("Fuente: Alimento personalizado.");
    expect(render("recipe")).toContain("Fuente: Receta propia.");
  });

  it("con una fuente desconocida muestra el código y los créditos", () => {
    const html = render("otra");
    expect(html).toContain("Fuente: otra.");
    expect(html).toContain('href="/fuentes"');
  });

  it("getSourceInfo ignora claves heredadas del prototipo", () => {
    expect(getSourceInfo("toString")).toBeNull();
    expect(getSourceInfo("usda_fndds")?.odbl).toBe(false);
  });
});
