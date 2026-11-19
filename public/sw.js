// Service worker mínimo de FitApp: hace la app instalable.
// No cachea nada todavía; la estrategia offline se agrega en la fase 6 (Serwist).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler de fetch explícito (algunos navegadores lo exigen para ofrecer la instalación).
// Deja pasar todas las peticiones a la red.
self.addEventListener("fetch", () => {});
