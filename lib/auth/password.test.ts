import { describe, expect, it } from "vitest";

import {
  credentialsSchema,
  firstIssue,
  newPasswordSchema,
  passwordAuthMessage,
  signUpSchema,
} from "./password";

describe("esquemas de contraseña", () => {
  it("normaliza el email y exige contraseña al entrar", () => {
    expect(credentialsSchema.parse({ email: " a@b.cl ", password: "x" })).toEqual({
      email: "a@b.cl",
      password: "x",
    });
    expect(credentialsSchema.safeParse({ email: "a@b.cl", password: "" }).success).toBe(
      false,
    );
  });

  it("exige al menos 8 caracteres y como máximo 72 bytes al registrarse", () => {
    const corta = signUpSchema.safeParse({ email: "a@b.cl", password: "1234567" });
    expect(corta.success).toBe(false);
    if (!corta.success) expect(firstIssue(corta.error)).toMatch(/al menos 8/);
    expect(
      signUpSchema.safeParse({ email: "a@b.cl", password: "12345678" }).success,
    ).toBe(true);
    // 37 «ñ» son 74 bytes en UTF-8.
    expect(
      signUpSchema.safeParse({ email: "a@b.cl", password: "ñ".repeat(37) }).success,
    ).toBe(false);
  });

  it("exige que la confirmación coincida", () => {
    const r = newPasswordSchema.safeParse({ password: "12345678", confirm: "12345679" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssue(r.error)).toBe("Las contraseñas no coinciden.");
  });
});

describe("passwordAuthMessage", () => {
  it("no distingue email inexistente de contraseña incorrecta", () => {
    expect(
      passwordAuthMessage({ code: "invalid_credentials", status: 400 }, "entrar"),
    ).toBe("Email o contraseña incorrectos.");
  });

  it("traduce límites de intentos y contraseñas débiles", () => {
    expect(passwordAuthMessage({ status: 429 }, "entrar")).toMatch(/Demasiados intentos/);
    expect(passwordAuthMessage({ code: "over_request_rate_limit" }, "registro")).toMatch(
      /Demasiados intentos/,
    );
    expect(passwordAuthMessage({ code: "weak_password" }, "registro")).toMatch(/débil/);
  });

  it("usa un mensaje genérico por acción para códigos desconocidos", () => {
    expect(passwordAuthMessage({ code: "otro" }, "cambio")).toMatch(
      /cambiar la contraseña/,
    );
  });
});
