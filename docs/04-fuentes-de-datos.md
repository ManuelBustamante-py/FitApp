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
| **Tabla chilena de composición de alimentos** (INTA – U. de Chile) y **LATINFOODS / FAO-INFOODS** | Alimentos y preparaciones locales (porotos, pan marraqueta, cazuela…) | PDF/CD según la edición | **Sin licencia de reutilización confirmada: no se importa** (ver sección siguiente) | Alimentos locales sin código de barras |

**Notas:**
- Traducción: USDA está en inglés. Se agrega `name_es` (traducción supervisada de los ~13 mil genéricos) y la búsqueda indexa ambos idiomas.
- ODbL: si se redistribuye la base derivada de Open Food Facts (por ejemplo, una exportación pública), esa base debe compartirse con la misma licencia y se debe atribuir la fuente. El uso interno en la aplicación con atribución está permitido.
- Calidad en Open Food Facts: hay que descartar productos sin kcal o con valores imposibles (kcal > 900/100 g, macros que suman más de 105 g/100 g: tope de 100 g más 5 g de tolerancia por redondeo de etiqueta, el mismo criterio que USDA).

### Open Food Facts: importación y atribución

- ETL en `scripts/ingest/off/` (`npm run ingest:off`): lee el export CSV/JSONL descargado a mano, en streaming; filtra por `countries_tags` (Chile por defecto, LatAm con `--latam`); valida kcal ≤ 900 y nutrientes entre 0 y 100 g por 100 g (kJ se convierten a kcal ÷ 4,184); guarda el código de barras (`food.barcode`, `source_id`); mapea `categories_tags`/`main_category` a las mismas categorías en español de USDA (tabla en `off/categorias.ts`, "Sin categoría" si no hay equivalente) y rellena `name_en` desde `product_name_en`/`generic_name_en`; deduplica por código; y emite un informe con el motivo de cada producto descartado. Uso en [scripts/ingest/README.md](../scripts/ingest/README.md).
- **Atribución ODbL (obligatoria):** «Contiene información de Open Food Facts, disponible bajo la Open Database License (ODbL).» Se registra en `food.license` (`ODbL 1.0 (Open Food Facts)`) y en la tabla `data_source` (una fila por `food.source`, con nombre, licencia, texto de atribución y URL; la leen los usuarios autenticados). La app debe mostrar ese texto donde use datos de OFF.
- Compartir igual: no se redistribuye la base derivada. Si algún día se publica una exportación, debe ir bajo ODbL.

### Tabla chilena de composición de alimentos: licencia y decisión (#14)

**Decisión: no se importa nada por ahora.** Ninguna fuente consultada (revisión de 2026-11-25) otorga una licencia que permita incorporar y redistribuir estos datos en la app.

Fuentes consultadas:

| Fuente | Qué dice |
|---|---|
| [MINSAL, Composición de Alimentos](https://www.minsal.cl/composicion-de-alimentos/) | Publica el «CD Tabla Chilena de Composición Química de Alimentos, Actualización 2010» (.rar) y material de talleres (proyecto FAO TCP/RLA/3107). No declara licencia ni condiciones de reutilización; solo el pie «© Gobierno de Chile». Sin licencia explícita, rige el derecho de autor por defecto (todos los derechos reservados). |
| [Repositorio U. de Chile, Tabla de composición química de alimentos chilenos (Schmidt Hebbel et al., 1990)](https://repositorio.uchile.cl/handle/2250/121427) | Acceso abierto, pero bajo **CC BY-NC-ND 3.0 Chile**: no permite uso comercial ni obras derivadas. Es un PDF escaneado de 62 págs. (sin formato estructurado) y datos de 1990. Importarlo (transformar a filas de base de datos) sería una obra derivada. |
| [INTA, noticia sobre la Tabla de Composición de Alimentos 2018](https://inta.uchile.cl/noticias/56) | Edición vigente (INTA, U. de Chile; impresa/PDF). La página no informa descarga ni licencia. |
| [FAO/INFOODS, bases de datos](https://www.fao.org/infoods/infoods/tables-and-databases/international-databases/en/) y LATINFOODS (latinfoods.inta.cl) | Red de coordinación; no publican la tabla chilena con licencia abierta. |
| datos.gob.cl | No se encontró un conjunto de datos de la tabla con licencia abierta. |

Conclusión: la edición actual (2018) no tiene licencia abierta ni archivo estructurado descargable; la del MINSAL (2010) no declara licencia; la de 1990 es CC BY-NC-ND (prohíbe derivadas). Importar sería arriesgado, por lo que no se agregó ETL ni valor nuevo en `food.source`.

Mientras tanto, los alimentos locales se cubren con USDA, Open Food Facts y los alimentos personalizados del usuario (#17).

**Alternativa: pedir permiso por escrito al INTA** (instituto@inta.uchile.cl o el contacto vigente en inta.uchile.cl). Borrador:

> Asunto: Solicitud de autorización de uso de la Tabla de Composición de Alimentos (INTA)
>
> Estimados: desarrollo FitApp, una aplicación gratuita de registro de alimentación para personas en Chile. Quisiera pedir autorización por escrito para incorporar los valores de la Tabla de Composición de Alimentos (edición 2018 o la vigente) en la base de la aplicación, con atribución explícita al INTA – Universidad de Chile y a la edición usada. Agradeceré indicar bajo qué licencia o condiciones puede usarse, si existe una versión en formato estructurado (Excel/CSV) y si se permite el uso en una aplicación pública. Saludos cordiales.

Si llega el permiso: guardar la autorización en el repositorio (o su referencia), agregar `chile_inta` al CHECK de `food.source` con una migración nueva no destructiva, insertar la fila en `data_source` con la atribución exigida, crear `scripts/ingest/inta/` siguiendo el patrón de `usda` y `off` (dry-run, informe, validaciones ≤ 105 g/100 g, pruebas) y respetar la prioridad ya definida (tabla chilena sobre USDA).

## Búsqueda de alimentos (#15)

- RPC `public.search_food(q, max_results = 30)`, `security invoker` (la RLS entrega públicos + propios). Normaliza con `lower(f_unaccent(q))`; menos de 2 caracteres devuelve vacío; 6 a 14 dígitos buscan por `barcode` exacto.
- Candidatos: `ilike '%t1%t2%'` sobre `f_unaccent(name_es | name_en | brand)` o similitud de palabra `<%` (umbral por defecto 0,6) sobre `name_es`. Ambos usan los índices GIN trigram (`food_name_trgm_idx`, `food_name_en_trgm_idx`, `food_brand_trgm_idx`) para cumplir p95 < 300 ms (RNF-04). Tope de 100 resultados.
- Deduplicación sin borrar datos: una fila por (nombre normalizado, marca; en OFF también código de barras), eligiendo la fuente de mayor prioridad (usuario > cl_inta > usda_fdc > usda_fndds > off > usda_branded). Resuelve los ~270 nombres repetidos entre SR Legacy y FNDDS.
- Orden: relevancia (exacto, prefijo, contiene, difuso), luego prioridad de fuente, luego similitud. Cada resultado muestra kcal por 100 g o 100 ml (nutriente `energy_kcal`) y la atribución con `FuenteAlimento`.

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
