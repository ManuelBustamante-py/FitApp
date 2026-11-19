import { createReadStream } from "node:fs";

/**
 * Parser CSV (RFC 4180) incremental: recibe trozos de texto y entrega las filas
 * completas. Soporta comillas, comillas escapadas ("") y saltos de línea dentro
 * de un campo. No carga el archivo entero en memoria.
 */
export class CsvParser {
  private field = "";
  private row: string[] = [];
  private inQuotes = false;
  private quoteSeen = false;
  private pendingCr = false;
  private started = false;

  feed(chunk: string): string[][] {
    const rows: string[][] = [];
    for (let i = 0; i < chunk.length; i++) {
      let ch = chunk[i];
      if (!this.started) {
        this.started = true;
        if (ch === "﻿") continue; // BOM
      }
      if (this.pendingCr) {
        this.pendingCr = false;
        if (ch === "\n") continue;
      }
      if (this.inQuotes) {
        if (this.quoteSeen) {
          this.quoteSeen = false;
          if (ch === '"') {
            this.field += '"';
            continue;
          }
          this.inQuotes = false;
          // El carácter que sigue a la comilla de cierre se procesa abajo.
        } else if (ch === '"') {
          this.quoteSeen = true;
          continue;
        } else {
          this.field += ch;
          continue;
        }
      }
      if (ch === '"' && this.field === "") {
        this.inQuotes = true;
        continue;
      }
      if (ch === ",") {
        this.row.push(this.field);
        this.field = "";
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        if (ch === "\r") this.pendingCr = true;
        ch = "\n";
        this.row.push(this.field);
        this.field = "";
        rows.push(this.row);
        this.row = [];
        continue;
      }
      this.field += ch;
    }
    return rows;
  }

  /** Entrega la última fila si el archivo no termina en salto de línea. */
  end(): string[][] {
    if (this.quoteSeen) {
      this.quoteSeen = false;
      this.inQuotes = false;
    }
    if (this.inQuotes) throw new Error("CSV mal formado: comillas sin cerrar al final");
    if (this.field !== "" || this.row.length > 0) {
      this.row.push(this.field);
      this.field = "";
      const last = this.row;
      this.row = [];
      return [last];
    }
    return [];
  }
}

/** Parsea un texto CSV completo (útil para archivos pequeños y pruebas). */
export function parseCsv(text: string): string[][] {
  const parser = new CsvParser();
  return [...parser.feed(text), ...parser.end()].filter(
    (row) => !(row.length === 1 && row[0] === ""),
  );
}

/** Convierte filas con encabezado en objetos { columna: valor }. */
export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((row) => toRecord(header, row));
}

function toRecord(header: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  header.forEach((name, i) => {
    record[name] = row[i] ?? "";
  });
  return record;
}

/** Lee un CSV con encabezado fila a fila, en streaming. */
export async function* readCsvRecords(
  path: string,
): AsyncGenerator<Record<string, string>> {
  const parser = new CsvParser();
  let header: string[] | null = null;
  const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
  for await (const chunk of stream) {
    for (const row of parser.feed(chunk as string)) {
      if (!header) {
        header = row;
        continue;
      }
      if (row.length === 1 && row[0] === "") continue;
      yield toRecord(header, row);
    }
  }
  for (const row of parser.end()) {
    if (!header) {
      header = row;
      continue;
    }
    yield toRecord(header, row);
  }
}

function quoteField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serializa filas a CSV (comillas solo cuando hacen falta, fin de línea \n). */
export function formatCsv(rows: string[][]): string {
  return rows.map((row) => row.map(quoteField).join(",")).join("\n") + "\n";
}
