import { describe, expect, it } from "vitest";

import {
  countryFromTimeZone,
  countryList,
  countryName,
  DEFAULT_COUNTRY,
  isForeignProduct,
  isLatamCountry,
  LATAM_COUNTRIES,
  LATAM_COUNTRY_CODES,
  normalizeCountry,
  proposeCountry,
  resolveUserCountry,
} from "./country";

describe("lista de países", () => {
  it("19 países de LatAm con código ISO alfa-2 y nombre en español", () => {
    expect(LATAM_COUNTRIES).toHaveLength(19);
    expect(new Set(LATAM_COUNTRY_CODES).size).toBe(19);
    for (const c of LATAM_COUNTRIES) expect(c.code).toMatch(/^[A-Z]{2}$/);
    expect(countryName("MX")).toBe("México");
    expect(countryName("DO")).toBe("República Dominicana");
    expect(countryName("US")).toBe("US");
    expect(DEFAULT_COUNTRY).toBe("CL");
  });

  it("normaliza y reconoce códigos", () => {
    expect(normalizeCountry(" pe ")).toBe("PE");
    expect(normalizeCountry("CHL")).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
    expect(isLatamCountry("PE")).toBe(true);
    expect(isLatamCountry("US")).toBe(false);
    expect(isLatamCountry("pe")).toBe(false);
    expect(isLatamCountry(null)).toBe(false);
  });

  it("une los nombres en español", () => {
    expect(countryList(["MX"])).toBe("México");
    expect(countryList(["MX", "PE"])).toBe("México y Perú");
    expect(countryList(["AR", "MX", "PE"])).toBe("Argentina, México y Perú");
  });
});

describe("país desde la zona horaria", () => {
  it("mapea zonas de LatAm", () => {
    expect(countryFromTimeZone("America/Santiago")).toBe("CL");
    expect(countryFromTimeZone("Pacific/Easter")).toBe("CL");
    expect(countryFromTimeZone("America/Argentina/Buenos_Aires")).toBe("AR");
    expect(countryFromTimeZone("America/Mexico_City")).toBe("MX");
    expect(countryFromTimeZone("America/Sao_Paulo")).toBe("BR");
    expect(countryFromTimeZone("America/Lima")).toBe("PE");
  });

  it("null fuera de LatAm o sin zona", () => {
    expect(countryFromTimeZone("Europe/Madrid")).toBeNull();
    expect(countryFromTimeZone("America/New_York")).toBeNull();
    expect(countryFromTimeZone("")).toBeNull();
    expect(countryFromTimeZone(undefined)).toBeNull();
  });
});

describe("propuesta de país (perfil sin país)", () => {
  it("prefiere la IP si es de LatAm", () => {
    expect(proposeCountry({ ipCountry: "mx", timezone: "America/Lima" })).toBe("MX");
  });

  it("si la IP no es de LatAm o falta, usa la zona horaria", () => {
    expect(proposeCountry({ ipCountry: "US", timezone: "America/Lima" })).toBe("PE");
    expect(proposeCountry({ ipCountry: null, timezone: "America/Bogota" })).toBe("CO");
  });

  it("si nada sirve, Chile", () => {
    expect(proposeCountry({ ipCountry: "ES", timezone: "Europe/Madrid" })).toBe("CL");
    expect(proposeCountry({})).toBe("CL");
  });
});

describe("resolveUserCountry", () => {
  it("usa el país del perfil antes que la IP", () => {
    expect(resolveUserCountry({ profileCountry: "AR", ipCountry: "MX" })).toBe("AR");
  });

  it("sin perfil, la IP si es de LatAm", () => {
    expect(resolveUserCountry({ profileCountry: null, ipCountry: "pe" })).toBe("PE");
  });

  it("sin perfil e IP fuera de LatAm (o sin IP), Chile", () => {
    expect(resolveUserCountry({ profileCountry: null, ipCountry: "US" })).toBe("CL");
    expect(resolveUserCountry({ profileCountry: null, ipCountry: null })).toBe("CL");
    expect(resolveUserCountry({ profileCountry: "", ipCountry: "XX" })).toBe("CL");
  });
});

describe("isForeignProduct", () => {
  it("solo si tiene países y ninguno es el del usuario", () => {
    expect(isForeignProduct(["MX"], "CL")).toBe(true);
    expect(isForeignProduct(["CL", "MX"], "CL")).toBe(false);
    expect(isForeignProduct(null, "CL")).toBe(false);
    expect(isForeignProduct([], "CL")).toBe(false);
  });
});
