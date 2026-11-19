import { describe, expect, it } from "vitest";

import { defaultTemplateName, parseTemplateForm } from "./template";

describe("defaultTemplateName", () => {
  it("arma «Actividad N min» con coma decimal", () => {
    expect(defaultTemplateName("Spinning", 20)).toBe("Spinning 20 min");
    expect(defaultTemplateName("Spinning", 17.5)).toBe("Spinning 17,5 min");
  });
  it("no pasa de 80 caracteres", () => {
    expect(defaultTemplateName("x".repeat(100), 20)).toHaveLength(80);
  });
});

describe("parseTemplateForm", () => {
  const valid = { name: "  Spinning 20  ", activityTypeId: "6", durationMin: "20,04" };

  it("acepta una plantilla válida y normaliza", () => {
    expect(parseTemplateForm(valid)).toEqual({
      success: true,
      data: { name: "Spinning 20", activityTypeId: 6, durationMin: 20 },
    });
  });

  it("acepta FormData", () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(valid)) form.set(k, v);
    expect(parseTemplateForm(form).success).toBe(true);
  });

  it("usa el nombre por defecto si viene vacío", () => {
    const result = parseTemplateForm(
      { ...valid, name: " " },
      (v) => `act${v.activityTypeId} ${v.durationMin}`,
    );
    expect(result.success && result.data.name).toBe("act6 20");
  });

  it("rechaza datos faltantes o fuera de rango", () => {
    expect(parseTemplateForm({ name: "", durationMin: "0" })).toEqual({
      success: false,
      errors: {
        activityTypeId: "Elige una actividad.",
        durationMin: "Ingresa la duración en minutos (entre 0,1 y 1.440).",
        name: "Ponle un nombre a la plantilla.",
      },
    });
    const long = parseTemplateForm({ ...valid, name: "x".repeat(81) });
    expect(!long.success && long.errors.name).toMatch(/80/);
    expect(parseTemplateForm({ ...valid, durationMin: "1441" }).success).toBe(false);
  });
});
