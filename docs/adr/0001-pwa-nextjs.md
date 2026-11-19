# ADR-0001 · PWA con Next.js en vez de una app nativa

- **Estado:** Aceptada (2026-11-19)

## Contexto
La aplicación se usa principalmente desde el celular (después de entrenar y al comer). La etapa inicial es de uso personal, con un solo desarrollador.

## Decisión
Construir una PWA con Next.js (App Router, TypeScript), instalable en Android/iOS y desplegada en Vercel.

## Consecuencias
- (+) Un solo código, despliegue inmediato y sin publicar en tiendas.
- (+) Cámara disponible para fotos y códigos de barras (getUserMedia / BarcodeDetector o una librería JS).
- (−) Sin acceso a Bluetooth en iOS ni a Health Connect / HealthKit. Si se necesita leer el pulso directamente desde sensores, se evaluará Expo/React Native (fase 6) reutilizando `lib/calc`.
