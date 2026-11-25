"use client";

import { useEffect } from "react";

import { establishSession } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/auth/safe-next";

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

    // El servidor guarda la sesión en cookies (Set-Cookie), igual que el login
    // con contraseña. Luego, recarga completa para que todo lea esas cookies.
    establishSession(accessToken, refreshToken)
      .then(({ ok }) => {
        if (!ok) goToLogin("enlace", next);
        else window.location.replace(next);
      })
      .catch(() => goToLogin("enlace", next));
  }, []);

  return (
    <p role="status" className="text-muted-foreground text-sm">
      Entrando…
    </p>
  );
}
