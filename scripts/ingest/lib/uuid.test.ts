import { describe, expect, it } from "vitest";

import { uuidV5 } from "./uuid.ts";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  it("coincide con el vector conocido de la RFC (www.example.com)", () => {
    expect(uuidV5("www.example.com", DNS_NAMESPACE)).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("es determinista y distingue nombres", () => {
    expect(uuidV5("a", DNS_NAMESPACE)).toBe(uuidV5("a", DNS_NAMESPACE));
    expect(uuidV5("a", DNS_NAMESPACE)).not.toBe(uuidV5("b", DNS_NAMESPACE));
  });

  it("rechaza un espacio de nombres inválido", () => {
    expect(() => uuidV5("a", "no-es-uuid")).toThrow();
  });
});
