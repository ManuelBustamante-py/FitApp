import { describe, expect, it } from "vitest";

import {
  barcodeCandidates,
  isValidBarcode,
  normalizeBarcode,
  pickBarcodeMatch,
  type BarcodeMatch,
} from "./barcode";

describe("isValidBarcode", () => {
  it("acepta EAN-13, EAN-8, UPC-A y GTIN-14 válidos", () => {
    expect(isValidBarcode("4006381333931")).toBe(true);
    expect(isValidBarcode("96385074")).toBe(true);
    expect(isValidBarcode("036000291452")).toBe(true);
    expect(isValidBarcode("10012345678902")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(isValidBarcode("4006381333932")).toBe(false);
    expect(isValidBarcode("96385075")).toBe(false);
  });

  it("rechaza largos no admitidos y caracteres no numéricos", () => {
    expect(isValidBarcode("123456")).toBe(false);
    expect(isValidBarcode("400638133393")).toBe(false);
    expect(isValidBarcode("40063813339a1")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });

  it("ignora espacios y guiones", () => {
    expect(isValidBarcode(" 4006381 333931 ")).toBe(true);
    expect(isValidBarcode("4006381-333931")).toBe(true);
  });
});

describe("normalizeBarcode / barcodeCandidates", () => {
  it("quita espacios y guiones", () => {
    expect(normalizeBarcode(" 40063 81-333931 ")).toBe("4006381333931");
  });

  it("un UPC-A también se busca como EAN-13 con 0 delante", () => {
    expect(barcodeCandidates("036000291452")).toEqual(["036000291452", "0036000291452"]);
  });

  it("un EAN-13 que empieza con 0 también se busca como UPC-A", () => {
    expect(barcodeCandidates("0036000291452")).toEqual(["0036000291452", "036000291452"]);
  });

  it("un EAN-13 normal tiene una sola variante", () => {
    expect(barcodeCandidates("4006381333931")).toEqual(["4006381333931"]);
  });
});

describe("pickBarcodeMatch", () => {
  const USER = "u1";
  const m = (
    id: string,
    source: string,
    countries: string[] | null,
    owner: string | null = null,
  ): BarcodeMatch => ({ id, source, countries, owner_user_id: owner });

  it("sin resultados, null", () => {
    expect(pickBarcodeMatch([], USER, "CL")).toBeNull();
  });

  it("el propio gana aunque sea de otro país", () => {
    const own = m("propio", "user", null, USER);
    const local = m("off-cl", "off", ["CL"]);
    expect(pickBarcodeMatch([local, own], USER, "CL")?.id).toBe("propio");
  });

  it("luego el del país del usuario antes que el de otro país", () => {
    const mx = m("off-mx", "off", ["MX"]);
    const cl = m("off-cl", "off", ["CL", "PE"]);
    expect(pickBarcodeMatch([mx, cl], USER, "CL")?.id).toBe("off-cl");
    expect(pickBarcodeMatch([mx, cl], USER, "MX")?.id).toBe("off-mx");
  });

  it("los sin país cuentan como locales y desempata la prioridad de fuente", () => {
    const mx = m("off-mx", "off", ["MX"]);
    const branded = m("branded", "usda_branded", null);
    expect(pickBarcodeMatch([mx, branded], USER, "CL")?.id).toBe("branded");
    const cl = m("off-cl", "off", ["CL"]);
    expect(pickBarcodeMatch([branded, cl], USER, "CL")?.id).toBe("off-cl");
  });

  it("el alimento propio de otro usuario no cuenta como propio", () => {
    const ajeno = m("ajeno", "user", null, "otro");
    const fdc = m("fdc", "usda_fdc", null);
    expect(pickBarcodeMatch([ajeno, fdc], USER, "CL")?.id).toBe("fdc");
  });
});
