# Ingesta de datos (ETL)

Scripts para poblar la base de alimentos propia (ver [docs/04-fuentes-de-datos.md](../../docs/04-fuentes-de-datos.md) y [ADR-0003](../../docs/adr/0003-base-alimentos-propia.md)). Se ejecutan con Node 22+ (`--experimental-strip-types`), sin compilar.

## USDA FoodData Central (Foundation, SR Legacy, FNDDS)

### 1. Descargar los datos

Descargar los CSV oficiales desde <https://fdc.nal.usda.gov/download-datasets> y descomprimirlos en `scripts/ingest/data/usda/` (carpeta ignorada por git; los datos crudos no se versionan). Versiones usadas al crear el ETL:

| Conjunto | Archivo | Tamaño aprox. |
|---|---|---|
| Foundation Foods | [FoodData_Central_foundation_food_csv_2025-12-18.zip](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip) | 3,5 MB |
| SR Legacy | [FoodData_Central_sr_legacy_food_csv_2018-04.zip](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip) | 6 MB |
| FNDDS (Survey) | [FoodData_Central_survey_food_csv_2024-10-31.zip](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip) | 3,3 MB |

Si USDA publica una versión nueva, basta con cambiar la fecha del nombre del archivo.

```bash
mkdir -p scripts/ingest/data/usda && cd scripts/ingest/data/usda
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip
for f in *.zip; do unzip -o "$f"; done   # en PowerShell: Expand-Archive <zip> -DestinationPath .
```

Los scripts reciben una o más carpetas y buscan `food.csv` en ellas o en sus subcarpetas (hasta dos niveles), así que basta con pasar `scripts/ingest/data/usda`.

Archivos que se leen de cada carpeta: `food.csv`, `nutrient.csv`, `food_nutrient.csv`, `food_portion.csv`, `measure_unit.csv`, `food_category.csv` (Foundation/SR Legacy) y `wweia_food_category.csv` (FNDDS). Del Foundation solo se importan las filas `foundation_food` (no las muestras de laboratorio).

### 2. Traducir los nombres (diccionario supervisado)

Los nombres en español salen de `scripts/ingest/usda/translations.csv`, versionado en el repositorio:

| Columna | Significado |
|---|---|
| `source`, `source_id` | `usda_fdc` (Foundation y SR Legacy) o `usda_fndds`, y el `fdc_id` |
| `name_en` | Nombre original de USDA |
| `name_es` | Nombre que se carga. **Vacío = no se carga** |
| `status` | `borrador` (propuesto o editado, sin revisar), `revisado_ia` (revisado nombre por nombre por IA con la guía de estilo) o `revisado` (confirmado por una persona) |
| `auto_es` | Última propuesta automática; las palabras sin glosario van entre `[corchetes]` |

Generar o actualizar el borrador (sin API externas; usa el glosario de `usda/glossary.ts` y `usda/glossary-extra.ts`, reordena los nombres de USDA separados por comas y concuerda género y número, p. ej. *Chicken, broiler, breast, meat only, raw* → *Pollo, pechuga, solo carne, crudo* y *Potatoes, raw* → *Papas, crudas*):

```bash
npm run ingest:usda:translations -- scripts/ingest/data/usda
```

El comando **fusiona** con el CSV existente, nunca lo pisa:

- Filas nuevas → `borrador`. `name_es` se llena solo si todas las palabras están en el glosario; si no, queda vacío y la propuesta parcial queda en `auto_es`.
- Filas `revisado` o `revisado_ia` → no se tocan (si USDA cambió el `name_en`, el comando lo avisa).
- Borradores con `name_es` editado a mano (distinto de `auto_es`) → se conserva `name_es`.
- Borradores automáticos → se actualizan con la nueva propuesta (útil al ampliar el glosario).
- Filas que ya no vienen en los datos → se conservan.

Al final muestra las palabras sin glosario más frecuentes: agregarlas a `glossary-extra.ts` y volver a correr el comando mejora los borradores pendientes.

**Cómo traduce el generador** (`usda/translate.ts`):

- Cada sustantivo del glosario tiene género y número, que se infieren del núcleo español (`agreementOf`, con excepciones en `GENERO_ESPECIAL`). Los modificadores se guardan en masculino singular y se flexionan para concordar con el sustantivo núcleo (`inflectAdjective`): *Papas, crudo* → *Papas, crudas*; *bajo en grasa* → *baja en grasa*. Los segmentos que solo traen un adjetivo (", crudo") concuerdan con el núcleo del primer segmento; si ese núcleo es un genérico (*Snacks*, *Bebidas*, *Pescado*; lista `GENERICOS`), manda el siguiente sustantivo.
- Los textos fijos de `SEGMENTOS` que empiezan con un participio concuerdan solos; con prefijo `~` se fuerza la concordancia de todas sus palabras en -o.
- Sufijos ingleses como *tomato-based*, *chocolate coated*, *butter flavored*, *X-type* o *X only* pasan a prefijo + sustantivo (*a base de tomate*, *cubierto de chocolate*, *sabor a mantequilla*, *tipo X*, *solo X*).
- Marcas y nombres propios: `MARCAS` (escritura oficial), segmentos en MAYÚSCULAS con palabras desconocidas (SR Legacy escribe así las marcas: *QUAKER*, *KRACKEL*), palabras en MAYÚSCULAS sueltas y con inicial mayúscula entre paréntesis (*(Navajo)*) se conservan sin marcarlas como faltantes.
- `NOMBRES` (en `glossary-extra.ts`) permite fijar la traducción de un nombre completo que el glosario no resuelve bien.
- Un segmento que repite al anterior como inicio (*Salsa, salsa mexicana*) lo reemplaza (*Salsa mexicana*).

El test `translations.test.ts` comprueba que el CSV versionado no tenga nombres vacíos ni palabras entre corchetes y que los borradores automáticos coincidan con lo que genera el glosario actual: si agregas palabras al glosario, vuelve a correr el comando y haz commit del CSV.

**Guía de estilo:** todos los nombres siguen [`usda/GUIA-TRADUCCION.md`](usda/GUIA-TRADUCCION.md) (español de Chile, orden natural «alimento, detalles», cortes de carne chilenos, marcas, unidades métricas, términos como *aderezo*/*aliño* y *postre tipo pudín*). Las 13 661 filas actuales se revisaron una por una con esa guía (`status = revisado_ia`); el glosario automático queda para las filas nuevas que traiga una versión futura de USDA.

**Flujo de revisión:**

1. Abrir `translations.csv` (planilla o editor), filtrar por `status = borrador` (pendientes) o `revisado_ia` (para confirmar).
2. Corregir `name_es` siguiendo la guía y cambiar `status` a `revisado`.
3. Hacer commit del CSV en un PR: el diff muestra exactamente qué nombres se revisaron.

### 3. Cargar en Supabase

Variables de entorno (en `.env.local`, que el comando lee si existe; nunca se versionan):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` (o `SUPABASE_URL`) | URL del proyecto |
| `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) | Clave secreta: omite la RLS para escribir alimentos públicos |

```bash
# Simulación: lee, traduce y valida sin escribir en la base
npm run ingest:usda -- scripts/ingest/data/usda --dry-run --report informe-usda.json

# Carga real
npm run ingest:usda -- scripts/ingest/data/usda --report informe-usda.json
```

Opciones:

| Opción | Efecto |
|---|---|
| `--only-reviewed` | Carga solo las filas `revisado` (confirmadas por una persona). Por defecto se cargan también `revisado_ia` y los `borrador` con `name_es` |
| `--dry-run` | No escribe en la base |
| `--report <archivo.json>` | Guarda el informe completo, con la lista de omitidos y errores |
| `--translations <csv>` | Otro diccionario de traducciones |
| `--batch-size <n>` | Alimentos por lote de escritura (500 por defecto) |

El informe en consola muestra importados, omitidos y errores (totales y por fuente), cuántos importados tienen traducción `revisado`, `revisado_ia` o `borrador`, cuántos tienen las kcal calculadas (`kcalCalculada` en el JSON), cuántas porciones se importaron y cuántas se descartaron por no traducirse por completo (con la lista de etiquetas, `porcionesSinTraducir`), y los omitidos por motivo:

- `sin_traduccion`: la fila no tiene `name_es` (nunca se carga con el nombre en inglés).
- `no_revisado`: con `--only-reviewed`, la fila es `borrador` o `revisado_ia`.
- `sin_energia`: USDA no informa kcal para ese alimento y los macros no alcanzan para calcularlas (ver más abajo; algunos de Foundation, como porotos secos de laboratorio, frutas sin carbohidratos informados o la sal).
- `duplicado`: el mismo `fdc_id` apareció en dos carpetas.

Los errores son valores imposibles (kcal > 902/100 g, macros que suman más de 105 g/100 g…) o fallos al escribir. El comando termina con código 1 si hubo errores.

### Qué se carga

- `food`: `name_es`, `name_en`, `category` (categorías FDC y WWEIA traducidas; las WWEIA salen de `usda/categorias.ts`, un mapa revisado por descripción en inglés cuyo test falla si USDA agrega una categoría sin traducir), `state` (`crudo`/`cocido` si el nombre en inglés lo dice, si no `na`), `basis = per_100g`, `source`, `source_id = fdc_id`, `license = 'CC0 / dominio público'`, `owner_user_id = null` (público).
- `food_nutrient`: los 11 nutrientes de `public.nutrient`, por 100 g. USDA ya informa por 100 g de porción comestible (también las bebidas). Se mapea por número de nutriente USDA, en orden de preferencia: energía 208 → 958 → 957 → 268 (kJ ÷ 4,184); carbohidratos 205 → 205.2; azúcares 269 → 269.3; fibra 291 → 293; grasas 204 → 298; proteínas 203; saturadas 606; trans 605; colesterol 601; sodio 307; alcohol 221. Las unidades se convierten a las de `public.nutrient` (g, mg, µg, kcal).
- **Energía calculada.** Si USDA no informa kcal (algunos Foundation), se calculan con Atwater 4/4/9 (`estimateEnergyKcal`): 4 kcal/g de proteínas y de carbohidratos y 9 kcal/g de grasas, y se cuentan aparte como `kcal_calculada` en el informe. Un macro ausente se toma como 0 solo si es razonable: carbohidratos ausentes se reemplazan por azúcares + fibra únicamente si suman 2 g/100 g o menos (si hay más, los carbohidratos existen y el alimento se omite como `sin_energia` en vez de subestimar sus kcal); proteínas o grasas ausentes se aceptan con al menos dos macros informados o en alimentos casi puros en grasa (≥ 50 g/100 g: aceites, mantequilla). La validación (> 902 kcal/100 g, macros que suman más de 105 g, etc.) se aplica igual al valor calculado.
- `food_portion`: porciones caseras de las tres fuentes (FNDDS: "1 cup", "1 medium"…; SR Legacy y Foundation: cantidad + unidad + modificador), con gramos > 0. Se descartan "Quantity not specified", las cantidades guía y los pesos apareados de laboratorio. La etiqueta se traduce con el mismo glosario de alimentos más `usda/glossary-porciones.ts`: las unidades (taza, cucharada, onza, onza líquida, libra…) se pluralizan según la cantidad y los decimales llevan coma (*1 botella (4,2 onzas líquidas)*), los adjetivos concuerdan con el sustantivo (*1 rebanada grande o gruesa*, *1 unidad mediana*) y las dimensiones pasan a *de largo / de diámetro / de grosor*. Los nombres de marca (rachas de palabras con inicial mayúscula, p. ej. *Gerber Second Food*, *Earth's Best*) se dejan tal cual. **Solo se importan las etiquetas que quedan totalmente en español:** si queda alguna palabra sin traducir la porción se descarta y se informa en el reporte (`porcionesSinTraducir`); si la etiqueta supera los 80 caracteres de la base se le quitan las aclaraciones finales entre paréntesis y, si aun así no cabe, también se descarta. Con los datos actuales no se descarta ninguna.

### Idempotencia

Se puede correr las veces que haga falta sin duplicar filas:

- `food`: se busca el id existente por `(source, source_id)` y se hace upsert por id (el índice único es parcial y PostgREST no lo acepta como destino de `ON CONFLICT`).
- `food_nutrient`: se reemplazan las filas del alimento (borrar e insertar).
- `food_portion`: id determinista (UUID v5 de fuente, `fdc_id` e id de porción USDA), upsert por id y borrado de las que ya no vienen. Así un `meal_item` que apunta a una porción la conserva tras reimportar.

Si un lote falla, se reintenta alimento por alimento para aislar el error y seguir con el resto.

### Pruebas

La lógica pura (CSV, mapeo de nutrientes, unidades, glosario, porciones, fusión del CSV) tiene pruebas con Vitest y archivos de ejemplo pequeños en `usda/__fixtures__/` (`npm test`).

## Open Food Facts (Chile / LatAm)

Importa productos envasados con código de barras. Los datos son de Open Food Facts (OFF) y están bajo la **Open Database License (ODbL)**; ver [Atribución ODbL](#atribución-odbl).

### 1. Descargar el export (a mano)

No se descarga desde el script. Bajar a mano el export de productos desde <https://world.openfoodfacts.org/data> y dejarlo en `scripts/ingest/data/off/` (carpeta ignorada por git). Sirve cualquiera de estos, con o sin `.gz` (se descomprime al vuelo):

| Formato | Archivo | Tamaño aprox. |
|---|---|---|
| **JSONL (recomendado)** | `openfoodfacts-products.jsonl.gz` | ~14 GB comprimido |
| CSV (separado por tabuladores) | `en.openfoodfacts.org.products.csv.gz` | varios GB descomprimido |

**Usa el JSONL.** Es el formato recomendado porque trae `product_name_es`, `product_name_en` y `generic_name_en`, así que `name_en` (nombre en inglés del producto) sale con datos. El CSV no trae esas columnas (solo `product_name` y `generic_name`): con el CSV `name_en` queda **null** y el nombre sale de `product_name`. Si se usa el CSV, el ETL lo avisa en consola una sola vez.

El archivo se procesa en streaming, línea a línea: no se carga entero en memoria. Del JSONL se leen `code`, `product_name`, `product_name_es`, `product_name_en`, `generic_name_en`, `brands`, `quantity`, `countries_tags`, `categories_tags`, `main_category` y `nutriments` (claves `energy-kcal_100g`, `proteins_100g`, `fat_100g`… por 100 g). El CSV trae las mismas columnas planas (`*_100g` como columnas).

### 2. Simular y cargar

Variables de entorno: las mismas que USDA (`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY` en `.env.local`). Antes de cargar hay que aplicar la migración `data_source` (atribución por fuente).

```bash
# Simulación: filtra, valida y deduplica sin escribir en la base (solo Chile)
npm run ingest:off -- scripts/ingest/data/off/openfoodfacts-products.jsonl.gz --dry-run --report informe-off.json

# Carga real, Chile
npm run ingest:off -- scripts/ingest/data/off/openfoodfacts-products.jsonl.gz --report informe-off.json

# Chile + resto de LatAm, o una lista propia de países
npm run ingest:off -- scripts/ingest/data/off/openfoodfacts-products.jsonl.gz --latam
npm run ingest:off -- scripts/ingest/data/off/openfoodfacts-products.jsonl.gz --countries en:chile,en:peru
```

| Opción | Efecto |
|---|---|
| `--countries <tags>` | Etiquetas `countries_tags` de OFF separadas por coma. Por defecto `en:chile` |
| `--latam` | Suma los países de `LATAM_COUNTRY_TAGS` (`off/normalize.ts`) a la lista |
| `--dry-run` | No escribe en la base |
| `--report <archivo.json>` | Informe completo: un registro por cada producto descartado, con motivo y detalle |
| `--batch-size <n>` | Productos por lote de escritura (500 por defecto) |

### Reglas de validación

Un producto se importa solo si pertenece a algún país elegido y cumple todo lo siguiente (si no, se descarta y queda en el informe con su motivo):

| Motivo | Regla |
|---|---|
| `sin_codigo_barras` | `code` debe ser 6 a 14 dígitos (igual que el CHECK de `food.barcode`) |
| `sin_nombre` | Se usa `product_name_es`; si está vacío, `product_name` |
| `sin_energia` | Debe haber `energy-kcal_100g` o kJ (`energy-kj_100g` / `energy_100g`); los kJ se convierten con kcal = kJ ÷ 4,184 |
| `kcal_fuera_de_rango` | kcal entre 0 y 900 por 100 g |
| `nutriente_fuera_de_rango` | Proteínas, grasas, grasas saturadas y trans, carbohidratos, azúcares, fibra, alcohol, sodio, colesterol y sal: entre 0 y 100 g por 100 g |
| `macros_suman_mas_de_100` | Proteínas + grasas + carbohidratos ≤ 105 g (tolerancia de 5 g por redondeo de etiqueta) |
| `valor_no_numerico` | Un nutriente presente pero no numérico |
| `linea_ilegible` | JSONL con una línea que no es JSON válido |

Los productos de otros países solo se cuentan (`fueraDePais`). Los códigos de barras repetidos se deduplican conservando la primera aparición (`duplicados`, con su lista). El informe incluye además la cobertura de categorías (`categorias`: con categoría, "Sin categoría", con nombre en inglés y las 20 etiquetas sin mapear más frecuentes en productos que quedaron sin categoría), también en el JSON de `--report`. El resumen en consola muestra leídos, fuera de país, importados, descartados, duplicados y descartados por motivo; el JSON trae además cada registro. Termina con código 1 si hubo errores al escribir.

### Qué se carga

- `food`: `name_es` (producto), `brand` (primera marca), `barcode`, `basis` (`per_100ml` si `quantity` es un volumen: ml, cl, l; si no `per_100g`), `state = na`, `source = 'off'`, `source_id` = código de barras, `license = 'ODbL 1.0 (Open Food Facts)'`, `owner_user_id = null` (público). `name_en` sale de `product_name_en` (o `generic_name_en`; null si no hay; con el CSV siempre null, ver arriba). `category` usa las MISMAS categorías en español que USDA: se mapea `main_category` y `categories_tags` con la tabla revisable `off/categorias.ts` (etiqueta OFF sin prefijo de idioma → categoría WWEIA de `usda/categorias.ts`), eligiendo la etiqueta más específica con mapeo; sin coincidencia queda "Sin categoría", nunca null. Las etiquetas en español que trae OFF sin taxonomizar (`es:yogures`, `es:galletas`…) tienen su bloque propio en la tabla. Las etiquetas genéricas (`beverages`, `snacks`, `bebidas`…) no se mapean a propósito. Para ampliar la cobertura, agrega filas a esa tabla mirando el informe.
- `food_nutrient`: energía (kcal), proteínas, carbohidratos, azúcares, fibra, grasas, saturadas, trans, colesterol (g → mg), sodio (g → mg; si falta, sal × 400 mg) y alcohol, por 100 g o 100 ml. No hay porciones.

### Idempotencia

El id de `food` es un UUID v5 determinista del código de barras, así que reimportar actualiza la misma fila (upsert por id); `food_nutrient` se reemplaza por producto. OFF se reimporta mensualmente. Los alimentos de OFF quedan por debajo de los de USDA y la tabla chilena en la prioridad de duplicados (ver docs/04).

### Atribución ODbL

Los datos de OFF requieren atribución y, si se redistribuye una base derivada, compartirla bajo la misma licencia. En FitApp queda registrada en:

- `food.license` de cada producto (`ODbL 1.0 (Open Food Facts)`) y `food.source = 'off'`.
- La tabla `public.data_source` (migración `20261120120000_data_source.sql`), con el texto: «Contiene información de Open Food Facts, disponible bajo la Open Database License (ODbL).» También registra las fuentes USDA. La app debe mostrar ese texto donde use productos de OFF (la app aún no tiene una pantalla de créditos).
- Esta documentación y [docs/04-fuentes-de-datos.md](../../docs/04-fuentes-de-datos.md).

### Pruebas

`off/*.test.ts` cubre el filtro de país, la validación, kJ → kcal, la deduplicación y el informe con fixtures pequeños en `off/__fixtures__/` (`npm test`).
