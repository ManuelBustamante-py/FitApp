import type { Metadata } from "next";

import { MagicLinkCallback } from "./magic-link-callback";

export const metadata: Metadata = { title: "Entrando…" };

/**
 * Destino del enlace mágico (flujo implícito): Supabase redirige aquí con la
 * sesión o el error en el fragmento (#access_token=… / #error_code=…), que solo
 * se puede leer en el navegador.
 */
export default function AuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">FitApp</h1>
      <MagicLinkCallback />
    </main>
  );
}
