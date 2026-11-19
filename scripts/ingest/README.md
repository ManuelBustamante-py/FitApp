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
| `status` | `borrador` (propuesto o editado, sin revisar) o `revisado` |
| `auto_es` | Última propuesta automática; las palabras sin glosario van entre `[corchetes]` |

Generar o actualizar el borrador (sin API externas; usa el glosario de `usda/glossary.ts` y reordena los nombres de USDA separados por comas, p. ej. *Chicken, broiler, breast, meat only, raw* → *Pollo, pechuga, solo carne, crudo*):

```bash
npm run ingest:usda:translations -- scripts/ingest/data/usda
```

El comando **fusiona** con el CSV existente, nunca lo pisa:

- Filas nuevas → `borrador`. `name_es` se llena solo si todas las palabras están en el glosario; si no, queda vacío y la propuesta parcial queda en `auto_es`.
- Filas `revisado` → no se tocan (si USDA cambió el `name_en`, el comando lo avisa).
- Borradores con `name_es` editado a mano (distinto de `auto_es`) → se conserva `name_es`.
- Borradores automáticos → se actualizan con la nueva propuesta (útil al ampliar el glosario).
- Filas que ya no vienen en los datos → se conservan.

Al final muestra las palabras sin glosario más frecuentes: agregarlas a `glossary.ts` y volver a correr el comando mejora los borradores pendientes.

**Flujo de revisión:**

1. Abrir `translations.csv` (planilla o editor), filtrar por `status = borrador`.
2. Corregir `name_es` (o completarlo a partir de `auto_es`) y cambiar `status` a `revisado`.
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
| `--only-reviewed` | Carga solo las filas `revisado` (por defecto se cargan también los `borrador` con `name_es`) |
| `--dry-run` | No escribe en la base |
| `--report <archivo.json>` | Guarda el informe completo, con la lista de omitidos y errores |
| `--translations <csv>` | Otro diccionario de traducciones |
| `--batch-size <n>` | Alimentos por lote de escritura (500 por defecto) |

El informe en consola muestra importados, omitidos y errores (totales y por fuente), cuántos importados tienen traducción `revisado` o `borrador` y los omitidos por motivo:

- `sin_traduccion`: la fila no tiene `name_es` (nunca se carga con el nombre en inglés).
- `no_revisado`: con `--only-reviewed`, la fila es `borrador`.
- `sin_energia`: USDA no informa kcal para ese alimento (algunos de Foundation).
- `duplicado`: el mismo `fdc_id` apareció en dos carpetas.

Los errores son valores imposibles (kcal > 902/100 g, macros que suman más de 105 g/100 g…) o fallos al escribir. El comando termina con código 1 si hubo errores.

### Qué se carga

- `food`: `name_es`, `name_en`, `category` (categorías FDC traducidas; las WWEIA de FNDDS quedan en inglés), `state` (`crudo`/`cocido` si el nombre en inglés lo dice, si no `na`), `basis = per_100g`, `source`, `source_id = fdc_id`, `license = 'CC0 / dominio público'`, `owner_user_id = null` (público).
- `food_nutrient`: los 11 nutrientes de `public.nutrient`, por 100 g. USDA ya informa por 100 g de porción comestible (también las bebidas). Se mapea por número de nutriente USDA, en orden de preferencia: energía 208 → 958 → 957 → 268 (kJ ÷ 4,184); carbohidratos 205 → 205.2; azúcares 269 → 269.3; fibra 291 → 293; grasas 204 → 298; proteínas 203; saturadas 606; trans 605; colesterol 601; sodio 307; alcohol 221. Las unidades se convierten a las de `public.nutrient` (g, mg, µg, kcal).
- `food_portion`: porciones caseras de las tres fuentes (FNDDS: "1 cup", "1 medium"…; SR Legacy y Foundation: cantidad + unidad + modificador), con gramos > 0 y la etiqueta traducida por reglas (cup → taza, tbsp → cucharada, tsp → cucharadita, fl oz → onza líquida, slice → rebanada, "1 medium" → "1 unidad mediana"…). Se descartan "Quantity not specified", las cantidades guía y los pesos apareados de laboratorio.

### Idempotencia

Se puede correr las veces que haga falta sin duplicar filas:

- `food`: se busca el id existente por `(source, source_id)` y se hace upsert por id (el índice único es parcial y PostgREST no lo acepta como destino de `ON CONFLICT`).
- `food_nutrient`: se reemplazan las filas del alimento (borrar e insertar).
- `food_portion`: id determinista (UUID v5 de fuente, `fdc_id` e id de porción USDA), upsert por id y borrado de las que ya no vienen. Así un `meal_item` que apunta a una porción la conserva tras reimportar.

Si un lote falla, se reintenta alimento por alimento para aislar el error y seguir con el resto.

### Pruebas

La lógica pura (CSV, mapeo de nutrientes, unidades, glosario, porciones, fusión del CSV) tiene pruebas con Vitest y archivos de ejemplo pequeños en `usda/__fixtures__/` (`npm test`).
