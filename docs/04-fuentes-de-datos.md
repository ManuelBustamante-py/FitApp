# 04 · Fuentes de datos nutricionales

## Estrategia

1. **Base propia en Postgres**, poblada con descargas masivas de fuentes abiertas. Las búsquedas no dependen de una API externa en tiempo real.
2. **Formato canónico:** nutrientes por 100 g (o por 100 ml), con porciones caseras como tabla aparte.
3. **Trazabilidad:** cada registro guarda `source`, `source_id`, `license` e `imported_at`.
4. **Prioridad cuando hay duplicados:** alimento del usuario > tabla chilena > USDA Foundation/SR Legacy > USDA FNDDS > Open Food Facts > USDA Branded.
5. Las API comerciales y el scraping quedan como **complementos evaluados**, no como base.

## Fuentes abiertas (base inicial)

| Fuente | Contenido | Formato | Licencia | Uso en FitApp |
|---|---|---|---|---|
| **USDA FoodData Central** – Foundation + SR Legacy | ~8 mil alimentos básicos (frutas, carnes, cereales, crudo/cocido) | CSV/JSON | Dominio público (CC0) | Núcleo de alimentos genéricos |
| **USDA FNDDS** | ~5 mil alimentos *tal como se comen* (sopas, postres, platos) con **porciones caseras en gramos** | CSV/JSON | Dominio público | Platos preparados y porciones (taza, cucharada) |
| **USDA Branded Foods** | ~400 mil productos de EE. UU. | CSV/JSON | Dominio público | Opcional; poca relevancia en Chile |
| **Open Food Facts** | Productos envasados con código de barras; miles de Chile y Latinoamérica | Volcado Parquet/CSV/JSONL + API | Base: **ODbL** (compartir igual); imágenes CC BY-SA | Productos chilenos y escaneo de códigos de barras |
| **Tabla chilena de composición de alimentos** (INTA – U. de Chile) y **LATINFOODS / FAO-INFOODS** | Alimentos y preparaciones locales (porotos, pan marraqueta, cazuela…) | PDF/Excel según la edición | Verificar licencia y permiso de uso | Alimentos locales sin código de barras |

**Notas:**
- Traducción: USDA está en inglés. Se agrega `name_es` (traducción supervisada de los ~13 mil genéricos) y la búsqueda indexa ambos idiomas.
- ODbL: si se redistribuye la base derivada de Open Food Facts (por ejemplo, una exportación pública), esa base debe compartirse con la misma licencia y se debe atribuir la fuente. El uso interno en la aplicación con atribución está permitido.
- Calidad en Open Food Facts: hay que descartar productos sin kcal o con valores imposibles (kcal > 900/100 g, macros que suman más de 100 g).

## API comerciales (complemento, evaluar en la fase 5)

| API | Fortaleza | Consideraciones |
|---|---|---|
| Nutritionix | Restaurantes y marcas; lenguaje natural ("2 huevos y una tostada") | Mayormente de pago; foco en EE. UU. |
| Edamam Food Database | Análisis de recetas y lenguaje natural | Plan gratuito limitado; atribución obligatoria |
| FatSecret Platform | Buena cobertura en países de habla hispana | Plan básico con atribución; funciones premium de pago |

Los términos y precios cambian: revisarlos al implementar. Ninguna de estas API permite, en general, **guardar en caché indefinidamente** ni redistribuir sus datos.

## Scraping de supermercados (Lider, Jumbo, Unimarc, Santa Isabel…)

Estado: **no planificado para el MVP**; se evaluará con revisión legal.

- Los términos de servicio de estos sitios suelen prohibir la extracción automatizada.
- Si se aprueba: solo tablas nutricionales de productos de interés, respetando `robots.txt`, con baja frecuencia y sin copiar imágenes ni textos de marketing.
- Alternativa preferida: aportar los productos faltantes a **Open Food Facts** (escaneando la etiqueta), lo que a la vez enriquece la base abierta.

## Pipeline de ingesta (ETL)

```
descarga → staging (tablas crudas) → normalización (unidades, nutrientes por 100 g)
→ validación (rangos) → deduplicación → upsert en food / food_nutrient / food_portion
→ indexación de búsqueda (pg_trgm + unaccent, tsvector es/en)
```
- Scripts en `scripts/ingest/` (TypeScript), idempotentes y con informe de filas insertadas y descartadas. USDA: ver [scripts/ingest/README.md](../scripts/ingest/README.md) (descarga, diccionario de traducciones supervisado en CSV y carga).
- Reimportación periódica: Open Food Facts mensual; USDA cuando haya una nueva versión (aprox. semestral).

## Reconocimiento por foto (fase 5)

- **No se entrena un modelo propio al inicio.** Se usa un modelo de visión (por ejemplo, la API de Claude) que devuelve candidatos de alimentos; estos se emparejan con la base propia por búsqueda.
- **Los gramos siempre los ingresa el usuario** (con una sugerencia de porción típica). Así se evita el mayor error de estas aplicaciones: adivinar el tamaño de la porción.
- Más adelante, las fotos confirmadas por el usuario (con su consentimiento) podrían formar un dataset propio.
