import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { translateName } from "./translate.ts";
import {
  formatTranslations,
  mergeTranslations,
  parseTranslations,
  resolveTranslation,
  type TranslationRow,
} from "./translations.ts";

const HEADER = "source,source_id,name_en,name_es,status,auto_es\n";

const row = (over: Partial<TranslationRow>): TranslationRow => ({
  source: "usda_fdc",
  sourceId: "1",
  nameEn: "Apples, raw",
  nameEs: "Manzanas, crudas",
  status: "borrador",
  autoEs: "Manzanas, crudas",
  ...over,
});

describe("parseTranslations", () => {
  it("lee el CSV y asume borrador si status está vacío", () => {
    const rows = parseTranslations(
      HEADER + 'usda_fdc,1,"Apples, raw","Manzanas, crudas",,"Manzanas, crudas"\n',
    );
    expect(rows).toEqual([row({ nameEs: "Manzanas, crudas", status: "borrador" })]);
    expect(parseTranslations("")).toEqual([]);
  });

  it.each([
    [HEADER + "usda_fdc,1,a,b,listo,c\n", /status "listo" inválido/],
    [HEADER + "usda_fdc,1,a,,revisado,c\n", /debe tener name_es/],
    [HEADER + ",1,a,b,borrador,c\n", /falta source/],
    [HEADER + "usda_fdc,1,a,b,borrador,c\nusda_fdc,1,a,b,borrador,c\n", /repetida/],
    ["source,source_id\nusda_fdc,1\n", /sin columnas/],
  ])("rechaza filas inválidas (%#)", (text, error) => {
    expect(() => parseTranslations(text)).toThrow(error);
  });

  it("formatea ordenado por fuente e id numérico y es reversible", () => {
    const rows = [
      row({ source: "usda_fndds", sourceId: "5" }),
      row({ sourceId: "10" }),
      row({ sourceId: "9", nameEn: 'Beef, trimmed to 1/8" fat' }),
    ];
    const text = formatTranslations(rows);
    expect(text.startsWith(HEADER)).toBe(true);
    expect(parseTranslations(text).map((r) => `${r.source}:${r.sourceId}`)).toEqual([
      "usda_fdc:9",
      "usda_fdc:10",
      "usda_fndds:5",
    ]);
    expect(parseTranslations(text)[0].nameEn).toBe('Beef, trimmed to 1/8" fat');
  });
});

describe("mergeTranslations", () => {
  const candidate = (sourceId: string, nameEn: string) => ({
    source: "usda_fdc",
    sourceId,
    nameEn,
    auto: translateName(nameEn),
  });

  it("agrega filas nuevas como borrador; name_es solo si la traducción es completa", () => {
    const { rows, stats } = mergeTranslations(
      [],
      [candidate("1", "Apples, raw"), candidate("2", "Frobnicates, raw")],
    );
    expect(rows).toEqual([
      row({}),
      row({
        sourceId: "2",
        nameEn: "Frobnicates, raw",
        nameEs: "",
        autoEs: "[frobnicates], crudos",
      }),
    ]);
    expect(stats.added).toBe(2);
  });

  it("no toca las filas revisadas, aunque cambie el nombre en USDA", () => {
    const reviewed = row({ nameEs: "Manzana cruda", status: "revisado" });
    const { rows, stats } = mergeTranslations(
      [reviewed],
      [candidate("1", "Apples, raw, with skin")],
    );
    expect(rows).toEqual([reviewed]);
    expect(stats).toMatchObject({ preserved: 1, reviewedNameChanged: 1 });
  });

  it("conserva el name_es editado a mano en un borrador y actualiza auto_es", () => {
    const edited = row({ nameEs: "Manzana cruda", autoEs: "Manzanas, crudo" });
    const { rows, stats } = mergeTranslations(
      [edited],
      [candidate("1", "Apples, raw, with skin")],
    );
    expect(rows[0]).toEqual({
      ...edited,
      nameEn: "Apples, raw, with skin",
      autoEs: "Manzanas, crudas, con cáscara",
    });
    expect(stats.preserved).toBe(1);
  });

  it("actualiza los borradores automáticos y cuenta los que no cambian", () => {
    const auto = row({ nameEs: "", autoEs: "[apples], crudo" });
    const same = row({ sourceId: "2" });
    const { rows, stats } = mergeTranslations(
      [auto, same],
      [candidate("1", "Apples, raw"), candidate("2", "Apples, raw")],
    );
    expect(rows[0].nameEs).toBe("Manzanas, crudas");
    expect(stats).toMatchObject({ updated: 1, unchanged: 1 });
  });

  it("conserva filas que ya no vienen en los datos e ignora candidatos repetidos", () => {
    const old = row({ sourceId: "99" });
    const { rows, stats } = mergeTranslations(
      [old],
      [candidate("1", "Apples, raw"), candidate("1", "Apples, raw")],
    );
    expect(rows.map((r) => r.sourceId)).toEqual(["1", "99"]);
    expect(stats).toMatchObject({ added: 1, notInInput: 1 });
  });

  it("es idempotente: fusionar dos veces da el mismo CSV", () => {
    const candidates = [
      candidate("1", "Apples, raw"),
      candidate("2", "Frobnicates, raw"),
    ];
    const first = mergeTranslations([], candidates).rows;
    const second = mergeTranslations(
      parseTranslations(formatTranslations(first)),
      candidates,
    );
    expect(formatTranslations(second.rows)).toBe(formatTranslations(first));
    expect(second.stats.unchanged).toBe(2);
  });
});

describe("resolveTranslation", () => {
  it("omite filas sin name_es o inexistentes", () => {
    expect(resolveTranslation(undefined, false)).toEqual({
      ok: false,
      reason: "sin_traduccion",
    });
    expect(resolveTranslation(row({ nameEs: "" }), false)).toEqual({
      ok: false,
      reason: "sin_traduccion",
    });
  });

  it("carga borradores salvo con --only-reviewed", () => {
    expect(resolveTranslation(row({}), false)).toEqual({
      ok: true,
      nameEs: "Manzanas, crudas",
      status: "borrador",
    });
    expect(resolveTranslation(row({}), true)).toEqual({
      ok: false,
      reason: "no_revisado",
    });
    expect(resolveTranslation(row({ status: "revisado" }), true)).toMatchObject({
      ok: true,
      status: "revisado",
    });
  });
});

describe("translations.csv versionado", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "translations.csv");
  const rows = parseTranslations(readFileSync(path, "utf8"));

  it("tiene nombre en español para (casi) todas las filas y sin palabras marcadas como faltantes", () => {
    expect(rows.length).toBeGreaterThan(13000);
    expect(rows.filter((r) => r.nameEs === "")).toEqual([]);
    expect(rows.filter((r) => /[[\]]/.test(r.nameEs))).toEqual([]);
  });

  it(
    "los borradores automáticos coinciden con lo que genera hoy el glosario",
    { timeout: 60_000 },
    () => {
      // Si este test falla, hay que volver a correr `npm run ingest:usda:translations`.
      const stale = rows
        .filter((r) => r.status === "borrador" && r.nameEs === r.autoEs)
        .filter((r) => translateName(r.nameEn).text !== r.autoEs)
        .map((r) => r.nameEn);
      expect(stale).toEqual([]);
    },
  );

  it("los revisados y los editados a mano no se tocan al regenerar", () => {
    const candidate = (sourceId: string, nameEn: string) => ({
      source: "usda_fdc",
      sourceId,
      nameEn,
      auto: translateName(nameEn),
    });
    const reviewed = row({ nameEs: "Manzana revisada", status: "revisado", autoEs: "x" });
    const edited = row({
      sourceId: "2",
      nameEs: "Mi nombre",
      autoEs: "Manzanas, crudas",
    });
    const { rows: merged } = mergeTranslations(
      [reviewed, edited],
      [candidate("1", "Apples, raw"), candidate("2", "Apples, raw")],
    );
    expect(merged.find((r) => r.sourceId === "1")?.nameEs).toBe("Manzana revisada");
    expect(merged.find((r) => r.sourceId === "2")?.nameEs).toBe("Mi nombre");
  });
});
