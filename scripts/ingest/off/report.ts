/** Informe del ETL de Open Food Facts: conteos y motivo por cada registro descartado. */

import { SIN_CATEGORIA } from "./categorias.ts";
import type { OffFood } from "./normalize.ts";

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
  /** Cobertura de categorías entre los importados. */
  categorias: {
    conCategoria: number;
    sinCategoria: number;
    /** Importados con name_en (product_name_en o generic_name_en). */
    conNombreEn: number;
    /** Las 20 etiquetas más frecuentes sin mapeo, en productos que quedaron "Sin categoría". */
    etiquetasSinMapear: { etiqueta: string; productos: number }[];
  };
  /** Un registro por producto descartado, con su motivo. */
  invalidos: InvalidItem[];
  duplicados: InvalidItem[];
  errores: InvalidItem[];
}

export const TOP_ETIQUETAS_SIN_MAPEAR = 20;

export interface InfoCategoria {
  sinCategoria: boolean;
  conNombreEn: boolean;
  etiquetasSinMapear: readonly string[];
}

/** Datos de categoría de un producto importado, para la cobertura del informe. */
export function infoCategoria(
  food: Pick<OffFood, "category" | "nameEn" | "etiquetasSinMapear"> | undefined,
): InfoCategoria | undefined {
  if (!food) return undefined;
  return {
    sinCategoria: food.category === SIN_CATEGORIA,
    etiquetasSinMapear: food.etiquetasSinMapear,
    conNombreEn: food.nameEn !== null,
  };
}

export class OffReportBuilder {
  private report: OffReport;
  private conteoEtiquetas = new Map<string, number>();

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
      categorias: {
        conCategoria: 0,
        sinCategoria: 0,
        conNombreEn: 0,
        etiquetasSinMapear: [],
      },
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

  imported(kcalDesdeKj: boolean, categoria?: InfoCategoria): void {
    this.report.totales.importados++;
    if (kcalDesdeKj) this.report.kcalDesdeKj++;
    if (!categoria) return;
    const c = this.report.categorias;
    if (categoria.conNombreEn) c.conNombreEn++;
    if (!categoria.sinCategoria) {
      c.conCategoria++;
      return;
    }
    c.sinCategoria++;
    for (const tag of categoria.etiquetasSinMapear) {
      this.conteoEtiquetas.set(tag, (this.conteoEtiquetas.get(tag) ?? 0) + 1);
    }
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
  failedAfterImport(
    item: InvalidItem,
    kcalDesdeKj: boolean,
    categoria?: InfoCategoria,
  ): void {
    this.report.totales.importados--;
    if (kcalDesdeKj) this.report.kcalDesdeKj--;
    if (categoria) {
      const c = this.report.categorias;
      if (categoria.conNombreEn) c.conNombreEn--;
      if (categoria.sinCategoria) {
        c.sinCategoria--;
        for (const tag of categoria.etiquetasSinMapear) {
          this.conteoEtiquetas.set(tag, (this.conteoEtiquetas.get(tag) ?? 1) - 1);
        }
      } else c.conCategoria--;
    }
    this.report.totales.errores++;
    this.report.errores.push(item);
  }

  build(): OffReport {
    this.report.categorias.etiquetasSinMapear = [...this.conteoEtiquetas]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_ETIQUETAS_SIN_MAPEAR)
      .map(([etiqueta, productos]) => ({ etiqueta, productos }));
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
  const cat = report.categorias;
  lines.push(
    `Categorías: con categoría ${cat.conCategoria} · "Sin categoría" ${cat.sinCategoria} · con nombre en inglés ${cat.conNombreEn}`,
  );
  if (cat.etiquetasSinMapear.length > 0) {
    lines.push(
      `Etiquetas sin mapear más frecuentes (en productos "Sin categoría"): ${cat.etiquetasSinMapear.map((e) => `${e.etiqueta} ${e.productos}`).join(", ")}`,
    );
  }
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
