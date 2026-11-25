import { describe, expect, it } from "vitest";

import { barcodeCandidates, isValidBarcode, normalizeBarcode } from "./barcode";

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
