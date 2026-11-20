/** Informe del ETL: importados, omitidos (con motivo) y errores. */

export type OmitReason = "sin_traduccion" | "no_revisado" | "sin_energia" | "duplicado";

export interface ReportItem {
  source: string;
  sourceId: string;
  nameEn: string;
  reason: string;
}

interface Counts {
  importados: number;
  omitidos: number;
  errores: number;
}

export interface IngestReport {
  generadoEn: string;
  simulacion: boolean;
  soloRevisados: boolean;
  carpetas: string[];
  totales: Counts;
  porFuente: Record<string, Counts>;
  /** Importados según el estado de su traducción. */
  importadosPorEstado: Record<string, number>;
  /** Importados cuyas kcal se calcularon con Atwater 4/4/9 porque USDA no las informa. */
  kcalCalculada: number;
  /** Porciones caseras importadas y descartadas por no traducirse por completo. */
  porciones: { importadas: number; sinTraducir: number };
  /** Etiquetas de porción descartadas (en inglés, sin repetir) con su cantidad. */
  porcionesSinTraducir: Record<string, number>;
  omitidosPorMotivo: Record<string, number>;
  omitidos: ReportItem[];
  errores: ReportItem[];
}

export class ReportBuilder {
  private readonly report: IngestReport;

  constructor(options: { dryRun: boolean; onlyReviewed: boolean; dirs: string[] }) {
    this.report = {
      generadoEn: new Date().toISOString(),
      simulacion: options.dryRun,
      soloRevisados: options.onlyReviewed,
      carpetas: options.dirs,
      totales: { importados: 0, omitidos: 0, errores: 0 },
      porFuente: {},
      importadosPorEstado: { revisado: 0, revisado_ia: 0, borrador: 0 },
      kcalCalculada: 0,
      porciones: { importadas: 0, sinTraducir: 0 },
      porcionesSinTraducir: {},
      omitidosPorMotivo: {},
      omitidos: [],
      errores: [],
    };
  }

  private counts(source: string): Counts {
    this.report.porFuente[source] ??= { importados: 0, omitidos: 0, errores: 0 };
    return this.report.porFuente[source];
  }

  imported(
    source: string,
    status: string,
    extra: { kcalCalculada?: boolean; portions?: number; untranslated?: string[] } = {},
  ): void {
    this.report.totales.importados++;
    if (extra.kcalCalculada) this.report.kcalCalculada++;
    this.report.porciones.importadas += extra.portions ?? 0;
    for (const label of extra.untranslated ?? []) {
      this.report.porciones.sinTraducir++;
      this.report.porcionesSinTraducir[label] =
        (this.report.porcionesSinTraducir[label] ?? 0) + 1;
    }
    this.counts(source).importados++;
    this.report.importadosPorEstado[status] =
      (this.report.importadosPorEstado[status] ?? 0) + 1;
  }

  /** Revierte un importado que después falló al escribir en la base. */
  failedAfterImport(item: ReportItem, status: string): void {
    this.report.totales.importados--;
    this.counts(item.source).importados--;
    this.report.importadosPorEstado[status]--;
    this.error(item);
  }

  omitted(item: ReportItem): void {
    this.report.totales.omitidos++;
    this.counts(item.source).omitidos++;
    this.report.omitidosPorMotivo[item.reason] =
      (this.report.omitidosPorMotivo[item.reason] ?? 0) + 1;
    this.report.omitidos.push(item);
  }

  error(item: ReportItem): void {
    this.report.totales.errores++;
    this.counts(item.source).errores++;
    this.report.errores.push(item);
  }

  build(): IngestReport {
    return this.report;
  }
}

/** Resumen legible para la consola. */
export function formatReport(report: IngestReport, maxErrors = 10): string {
  const lines: string[] = [];
  const t = report.totales;
  lines.push(
    report.simulacion
      ? "Simulación (--dry-run): no se escribió en la base."
      : "Carga terminada.",
  );
  lines.push(
    `Importados: ${t.importados} · Omitidos: ${t.omitidos} · Errores: ${t.errores}`,
  );
  for (const [source, c] of Object.entries(report.porFuente).sort()) {
    lines.push(
      `  ${source}: ${c.importados} importados, ${c.omitidos} omitidos, ${c.errores} errores`,
    );
  }
  const status = report.importadosPorEstado;
  lines.push(
    `Importados por traducción: ${status.revisado ?? 0} revisados, ${status.revisado_ia ?? 0} revisados por IA, ${status.borrador ?? 0} borradores`,
  );
  lines.push(`kcal calculadas (Atwater 4/4/9) en importados: ${report.kcalCalculada}`);
  lines.push(
    `Porciones: ${report.porciones.importadas} importadas, ${report.porciones.sinTraducir} descartadas por no traducirse por completo (${Object.keys(report.porcionesSinTraducir).length} etiquetas distintas)`,
  );
  const reasons = Object.entries(report.omitidosPorMotivo).sort();
  if (reasons.length > 0) {
    lines.push(`Omitidos por motivo: ${reasons.map(([r, n]) => `${r} ${n}`).join(", ")}`);
  }
  for (const e of report.errores.slice(0, maxErrors)) {
    lines.push(`  ✗ ${e.source}:${e.sourceId} ${e.nameEn} → ${e.reason}`);
  }
  if (report.errores.length > maxErrors) {
    lines.push(`  … y ${report.errores.length - maxErrors} errores más (ver --report)`);
  }
  return lines.join("\n");
}
