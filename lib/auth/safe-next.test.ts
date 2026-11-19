import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath", () => {
  it.each(["/", "/perfil", "/registro?fecha=2026-11-19", "/a/b#c"])(
    "acepta la ruta interna %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    [null],
    [undefined],
    [""],
    ["perfil"],
    ["https://malicioso.com"],
    ["//malicioso.com"],
    ["/\\malicioso.com"],
  ])("rechaza %j y devuelve la raíz", (next) => {
    expect(safeNextPath(next)).toBe("/");
  });
});
