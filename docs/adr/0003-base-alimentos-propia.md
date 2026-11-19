# ADR-0003 · Base de alimentos propia, importada de fuentes abiertas

- **Estado:** Aceptada (2026-11-19)

## Contexto
Las API comerciales (Nutritionix, Edamam, FatSecret) tienen límites de uso, costos y restricciones de caché. La aplicación necesita alimentos genéricos, platos preparados, productos chilenos, líquidos y postres.

## Decisión
Poblar una base propia en Postgres con USDA FoodData Central (Foundation, SR Legacy, FNDDS; dominio público), Open Food Facts (filtrado a Chile/LatAm; ODbL) y la tabla chilena de composición de alimentos (sujeta a su licencia). Se normaliza a valores por 100 g o 100 ml, con porciones caseras.

Las API comerciales se evaluarán como complemento en la fase 5. El scraping de supermercados no se hará sin revisión legal.

## Consecuencias
- (+) Búsqueda rápida, sin costo por consulta y con funcionamiento offline posible.
- (+) Control de la calidad y trazabilidad (fuente y licencia en cada fila).
- (−) Trabajo de ETL, traducción al español y deduplicación.
- (−) Obligación de atribución (y de compartir igual si se redistribuyen datos derivados de Open Food Facts).
