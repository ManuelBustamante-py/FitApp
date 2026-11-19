import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CsvParser, formatCsv, parseCsv, readCsvRecords, rowsToRecords } from "./csv.ts";

describe("parseCsv", () => {
  it("lee campos con comillas, comas, comillas escapadas y saltos de línea", () => {
    const text = 'a,b,c\n"1, uno","dice ""hola""","dos\nlíneas"\n3,,4\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1, uno", 'dice "hola"', "dos\nlíneas"],
      ["3", "", "4"],
    ]);
  });

  it("acepta CRLF, BOM y una última fila sin salto de línea", () => {
    expect(parseCsv('﻿"x","y"\r\n"1","2"\r\n"3","4"')).toEqual([
      ["x", "y"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("falla si una comilla queda sin cerrar", () => {
    expect(() => parseCsv('a\n"sin cerrar')).toThrow(/comillas/);
  });
});

describe("CsvParser", () => {
  it("da el mismo resultado aunque el texto llegue en trozos arbitrarios", () => {
    const text = '"id","name"\r\n"1","Leche, entera"\r\n"2","dice ""sí"""\r\n';
    const parser = new CsvParser();
    const rows: string[][] = [];
    for (const ch of text) rows.push(...parser.feed(ch));
    rows.push(...parser.end());
    expect(rows).toEqual(parseCsv(text));
    expect(rows).toHaveLength(3);
  });
});

describe("rowsToRecords / formatCsv", () => {
  it("convierte a objetos por encabezado y completa columnas faltantes", () => {
    expect(rowsToRecords([["a", "b"], ["1"]])).toEqual([{ a: "1", b: "" }]);
    expect(rowsToRecords([])).toEqual([]);
  });

  it("serializa con comillas solo cuando hace falta y es reversible", () => {
    const rows = [
      ["source", "name"],
      ["usda_fdc", 'Beef, trimmed to 1/8" fat'],
      ["x", " espacio"],
    ];
    const text = formatCsv(rows);
    expect(text).toBe(
      'source,name\nusda_fdc,"Beef, trimmed to 1/8"" fat"\nx," espacio"\n',
    );
    expect(parseCsv(text)).toEqual(rows);
  });
});

describe("readCsvRecords", () => {
  it("lee un archivo en streaming", async () => {
    const dir = mkdtempSync(join(tmpdir(), "csv-"));
    const path = join(dir, "t.csv");
    writeFileSync(path, '"id","v"\n"1","a"\n\n"2","b"');
    const records = [];
    for await (const r of readCsvRecords(path)) records.push(r);
    expect(records).toEqual([
      { id: "1", v: "a" },
      { id: "2", v: "b" },
    ]);
  });
});
