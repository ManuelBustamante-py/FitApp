/** Informe del ETL de Open Food Facts: conteos y motivo por cada registro descartado. */

export interface InvalidItem {
  /** Código de barras tal como vino (puede estar vacío o ser inválido). */
  code: string;
  name: string;
  reason: string;
  detail: string;
}

export interface OffReport {
  simulacion: boolean;
  paises: string[];
  totales: {
    leidos: number;
    fueraDePais: number;
    importados: number;
    invalidos: number;
    duplicados: number;
    errores: number;
  };
  /** Importados cuyas kcal se derivaron de kJ ÷ 4,184. */
  kcalDesdeKj: number;
  invalidosPorMotivo: Record<string, number>;
  /** Un registro por producto descartado, con su motivo. */
  invalidos: InvalidItem[];
  duplicados: InvalidItem[];
  errores: InvalidItem[];
}

export class OffReportBuilder {
  private report: OffReport;

  constructor(options: { dryRun: boolean; countries: readonly string[] }) {
    this.report = {
      simulacion: options.dryRun,
      paises: [...options.countries],
      totales: {
        leidos: 0,
        fueraDePais: 0,
        importados: 0,
        invalidos: 0,
        duplicados: 0,
        errores: 0,
      },
      kcalDesdeKj: 0,
      invalidosPorMotivo: {},
      invalidos: [],
      duplicados: [],
      errores: [],
    };
  }

  read(): void {
    this.report.totales.leidos++;
  }

  outOfCountry(): void {
    this.report.totales.fueraDePais++;
  }

  imported(kcalDesdeKj: boolean): void {
    this.report.totales.importados++;
    if (kcalDesdeKj) this.report.kcalDesdeKj++;
  }

  invalid(item: InvalidItem): void {
    this.report.totales.invalidos++;
    this.report.invalidosPorMotivo[item.reason] =
      (this.report.invalidosPorMotivo[item.reason] ?? 0) + 1;
    this.report.invalidos.push(item);
  }

  duplicate(item: InvalidItem): void {
    this.report.totales.duplicados++;
    this.report.duplicados.push(item);
  }

  /** Revierte un importado que después falló al escribir en la base. */
  failedAfterImport(item: InvalidItem, kcalDesdeKj: boolean): void {
    this.report.totales.importados--;
    if (kcalDesdeKj) this.report.kcalDesdeKj--;
    this.report.totales.errores++;
    this.report.errores.push(item);
  }

  build(): OffReport {
    return this.report;
  }
}

/** Resumen legible para la consola. */
export function formatReport(report: OffReport, maxExamples = 10): string {
  const t = report.totales;
  const lines = [
    report.simulacion
      ? "Simulación (--dry-run): no se escribió en la base."
      : "Carga terminada.",
    `Países: ${report.paises.join(", ")}`,
    `Leídos: ${t.leidos} · Fuera de país: ${t.fueraDePais} · Importados: ${t.importados} · Descartados: ${t.invalidos} · Duplicados: ${t.duplicados} · Errores de carga: ${t.errores}`,
    `kcal derivadas de kJ en importados: ${report.kcalDesdeKj}`,
  ];
  const reasons = Object.entries(report.invalidosPorMotivo).sort();
  if (reasons.length > 0) {
    lines.push(
      `Descartados por motivo: ${reasons.map(([r, n]) => `${r} ${n}`).join(", ")}`,
    );
  }
  for (const e of report.invalidos.slice(0, maxExamples)) {
    lines.push(`  ✗ ${e.code || "(sin código)"} ${e.name} → ${e.reason}: ${e.detail}`);
  }
  if (report.invalidos.length > maxExamples) {
    lines.push(`  … ${report.invalidos.length - maxExamples} más en el informe JSON`);
  }
  for (const e of report.errores.slice(0, maxExamples)) {
    lines.push(`  ✗ ${e.code} ${e.name} → ${e.detail}`);
  }
  return lines.join("\n");
}
