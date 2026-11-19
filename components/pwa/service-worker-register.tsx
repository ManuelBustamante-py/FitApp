"use client";

import { useEffect } from "react";

/**
 * Registra el service worker mínimo (public/sw.js) para que la app sea instalable.
 * La caché offline llega en la fase 6 (Serwist). En desarrollo no se registra
 * para no interferir con la recarga en caliente.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("No se pudo registrar el service worker", error);
      });
  }, []);

  return null;
}
