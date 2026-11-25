import { describe, expect, it } from "vitest";

import { magicLinkErrorMessage, parseMagicLink } from "./magic-link";

const SUPABASE = "https://abc.supabase.co";
const link = (qs: string, base = SUPABASE) => `${base}/auth/v1/verify?${qs}`;

describe("parseMagicLink", () => {
  it("extrae el hash del token y el tipo", () => {
    expect(
      parseMagicLink(
        `  ${link("token=f00ba4&type=magiclink&redirect_to=https://x.vercel.app/auth/callback")}  `,
        SUPABASE,
      ),
    ).toEqual({ tokenHash: "f00ba4", type: "magiclink" });
    expect(parseMagicLink(link("token=t&type=signup"), SUPABASE)).toEqual({
      tokenHash: "t",
      type: "signup",
    });
  });

  it("rechaza enlaces de otro origen o ruta", () => {
    expect(
      parseMagicLink(link("token=t&type=magiclink", "https://evil.co"), SUPABASE),
    ).toBeNull();
    expect(
      parseMagicLink(`${SUPABASE}/otra?token=t&type=magiclink`, SUPABASE),
    ).toBeNull();
  });

  it("rechaza tipos no permitidos, faltantes y texto que no es URL", () => {
    expect(parseMagicLink(link("token=t&type=email_change"), SUPABASE)).toBeNull();
    expect(parseMagicLink(link("type=magiclink"), SUPABASE)).toBeNull();
    expect(parseMagicLink(link("token=t"), SUPABASE)).toBeNull();
    expect(parseMagicLink("hola", SUPABASE)).toBeNull();
  });
});

describe("magicLinkErrorMessage", () => {
  it("explica el enlace usado o vencido", () => {
    expect(magicLinkErrorMessage("otp_expired")).toMatch(/una sola vez/);
  });
  it("usa el mensaje genérico para códigos desconocidos", () => {
    expect(magicLinkErrorMessage("<script>")).toMatch(/no es válido/);
  });
});
