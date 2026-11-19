import { describe, expect, it } from "vitest";

import { formatReport, ReportBuilder } from "./report.ts";

describe("ReportBuilder", () => {
  it("cuenta importados por fuente y estado, omitidos por motivo y errores", () => {
    const builder = new ReportBuilder({
      dryRun: false,
      onlyReviewed: false,
      dirs: ["d"],
    });
    builder.imported("usda_fdc", "revisado");
    builder.imported("usda_fdc", "borrador");
    builder.imported("usda_fndds", "borrador");
    builder.omitted({
      source: "usda_fdc",
      sourceId: "2",
      nameEn: "b",
      reason: "sin_traduccion",
    });
    builder.error({ source: "usda_fndds", sourceId: "3", nameEn: "c", reason: "kcal" });
    builder.failedAfterImport(
      { source: "usda_fdc", sourceId: "1", nameEn: "a", reason: "red" },
      "borrador",
    );
    const report = builder.build();
    expect(report.totales).toEqual({ importados: 2, omitidos: 1, errores: 2 });
    expect(report.porFuente).toEqual({
      usda_fdc: { importados: 1, omitidos: 1, errores: 1 },
      usda_fndds: { importados: 1, omitidos: 0, errores: 1 },
    });
    expect(report.importadosPorEstado).toEqual({ revisado: 1, borrador: 1 });
    expect(report.omitidosPorMotivo).toEqual({ sin_traduccion: 1 });

    const text = formatReport(report, 1);
    expect(text).toContain("Importados: 2 · Omitidos: 1 · Errores: 2");
    expect(text).toContain("1 revisados, 1 borradores");
    expect(text).toContain("sin_traduccion 1");
    expect(text).toContain("… y 1 errores más");
  });

  it("cuenta las kcal calculadas y las porciones descartadas", () => {
    const builder = new ReportBuilder({ dryRun: true, onlyReviewed: false, dirs: [] });
    builder.imported("usda_fdc", "borrador", {
      kcalCalculada: true,
      portions: 3,
      untranslated: ["1 frob", "1 frob"],
    });
    builder.imported("usda_fdc", "borrador", { portions: 2, untranslated: ["1 zap"] });
    const report = builder.build();
    expect(report.kcalCalculada).toBe(1);
    expect(report.porciones).toEqual({ importadas: 5, sinTraducir: 3 });
    expect(report.porcionesSinTraducir).toEqual({ "1 frob": 2, "1 zap": 1 });
    const text = formatReport(report);
    expect(text).toContain("kcal calculadas (Atwater 4/4/9) en importados: 1");
    expect(text).toContain("5 importadas, 3 descartadas");
  });

  it("indica cuando es una simulación", () => {
    const report = new ReportBuilder({
      dryRun: true,
      onlyReviewed: true,
      dirs: [],
    }).build();
    expect(formatReport(report)).toMatch(/^Simulación/);
    expect(report.soloRevisados).toBe(true);
  });
});
