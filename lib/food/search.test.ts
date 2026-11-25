import { describe, expect, it } from "vitest";

import {
  basisLabel,
  cleanQuery,
  isBarcode,
  isSearchable,
  normalizeQuery,
  countryRank,
  sourceRank,
} from "./search";

describe("búsqueda de alimentos", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizeQuery("  Plátano   MADURO ")).toBe("platano maduro");
    expect(normalizeQuery("Ñoquis")).toBe("noquis");
  });

  it("exige al menos 2 caracteres", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable(" á ")).toBe(false);
    expect(isSearchable("pa")).toBe(true);
  });

  it("limpia y acota la consulta", () => {
    expect(cleanQuery("  leche   entera ")).toBe("leche entera");
    expect(cleanQuery("x".repeat(500))).toHaveLength(100);
  });

  it("detecta códigos de barras de 6 a 14 dígitos", () => {
    expect(isBarcode("7802900123456")).toBe(true);
    expect(isBarcode("12345")).toBe(false);
    expect(isBarcode("123456789012345")).toBe(false);
    expect(isBarcode("78029a0123")).toBe(false);
  });

  it("ordena las fuentes según docs/04", () => {
    const order = ["cl_inta", "usda_fdc", "usda_fndds", "off", "usda_branded", "otra"];
    const ranks = order.map((s) => sourceRank(s, false));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(sourceRank("off", true)).toBeLessThan(sourceRank("cl_inta", false));
  });

  it("etiqueta la base nutricional", () => {
    expect(basisLabel("per_100ml")).toBe("100 ml");
    expect(basisLabel("per_100g")).toBe("100 g");
  });
});

describe("countryRank", () => {
  it("los del país del usuario y los sin país van antes que los de otros países", () => {
    expect(countryRank(["CL"], "CL")).toBe(0);
    expect(countryRank(["AR", "CL"], "CL")).toBe(0);
    expect(countryRank(null, "CL")).toBe(0);
    expect(countryRank([], "CL")).toBe(0);
    expect(countryRank(["MX"], "CL")).toBe(1);
    expect(countryRank(["MX"], "MX")).toBe(0);
  });
});
