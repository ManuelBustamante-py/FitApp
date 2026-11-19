# ADR-0002 · Supabase como base de datos, autenticación y almacenamiento

- **Estado:** Aceptada (2026-11-19)

## Contexto
Se necesitan cuentas de usuario, datos relacionales (alimentos ↔ nutrientes ↔ comidas), búsqueda de texto sobre cientos de miles de alimentos y almacenamiento de fotos, con costo cero en el MVP.

## Decisión
Usar Supabase: Postgres con Row Level Security, Supabase Auth y Storage. El esquema se versiona con migraciones en `supabase/migrations/`.

## Consecuencias
- (+) SQL real: vistas para el balance diario, `pg_trgm`/`unaccent` para la búsqueda e importación masiva con `COPY`.
- (+) La RLS aísla los datos de salud por usuario desde el primer día.
- (−) Límite de 500 MB de base de datos en el plan gratuito: se importan solo los subconjuntos relevantes (USDA genéricos + Open Food Facts Chile/LatAm, no Branded completo).
- (−) Dependencia de un proveedor, mitigada porque es Postgres estándar.
