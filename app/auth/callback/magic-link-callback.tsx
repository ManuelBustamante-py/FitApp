"use client";

import { useEffect } from "react";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/db/client";

function goToLogin(error: string, next: string) {
  const params = new URLSearchParams({ error });
  if (next !== "/") params.set("next", next);
  window.location.replace(`/login?${params}`);
}

export function MagicLinkCallback() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    // Saca los tokens de la barra de direcciones y del historial.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) {
      goToLogin(hash.get("error_code") ?? "enlace", next);
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) goToLogin("enlace", next);
        // Recarga completa para que el servidor lea las cookies de sesión.
        else window.location.replace(next);
      });
  }, []);

  return (
    <p role="status" className="text-muted-foreground text-sm">
      Entrando…
    </p>
  );
}
