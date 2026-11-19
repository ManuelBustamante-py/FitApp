# 06 · Modelo de datos

Diagrama entidad-relación: [uml/modelo-er.puml](uml/modelo-er.puml) · Modelo de dominio: [uml/clases-dominio.puml](uml/clases-dominio.puml).

## Tablas

### Usuario
| Tabla | Campos principales |
|---|---|
| `profile` | `user_id` (PK, FK auth.users), `display_name`, `sex`, `birth_date`, `height_cm`, `bmr_formula` (mifflin, harris_benedict, katch_mcardle, cunningham, measured), `bmr_measured_kcal?`, `sedentary_steps_threshold` (2.500 por defecto), `stride_m?`, `timezone`, `created_at` |
| `activity_schedule` | `user_id`, `weekday` (1–7) (PK compuesta), `mode` (`level` / `steps`), `level?` (bmr_only, sedentary, light, moderate, active, very_active, custom), `custom_factor?`, `steps_target?` |
| `daily_activity` | `user_id`, `day` (PK compuesta), `mode`, `level?`, `custom_factor?`, `steps_actual?`: ajuste de un día que reemplaza a la semana tipo |
| `goal` | `id`, `user_id`, `target_weight_kg`, `target_bmi`, `weekly_rate_kg`, `start_date`, `active` |
| `body_measurement` | `id`, `user_id`, `measured_at`, `weight_kg`, `waist_cm?`, `body_fat_pct?`, `note?` |

### Ejercicio
| Tabla | Campos principales |
|---|---|
| `activity_type` | `id`, `code`, `name_es`, `met`, `category` (cardio, fuerza…) |
| `workout_session` | `id`, `user_id`, `activity_type_id`, `started_at`, `duration_min`, `distance_km?`, `machine_kcal?`, `hr_avg?`, `hr_min?`, `hr_max?`, `rpe?`, `kcal_hr?`, `kcal_met?`, `kcal_selected`, `kcal_method`, `kcal_net`, `notes?` |
| `workout_template` | `id`, `user_id`, `name`, `activity_type_id`, `duration_min` |

### Alimentos
| Tabla | Campos principales |
|---|---|
| `food` | `id`, `name_es`, `name_en?`, `brand?`, `barcode?`, `category`, `state` (crudo, cocido, n/a), `basis` (`per_100g` / `per_100ml`), `density_g_ml?`, `source`, `source_id`, `license`, `owner_user_id?` (null = público), `search_vector`, `imported_at` |
| `nutrient` | `id`, `code` (energy_kcal, protein_g, carb_g, fat_g, fiber_g, sugar_g, sodium_mg…), `name_es`, `unit`, `sort_order` |
| `food_nutrient` | `food_id`, `nutrient_id`, `amount_per_100` |
| `food_portion` | `id`, `food_id`, `label_es` ("1 taza", "1 unidad mediana"), `grams` |
| `recipe` | `id`, `user_id`, `name`, `cooked_weight_g`, `food_id` (alimento generado con los valores por 100 g) |
| `recipe_ingredient` | `recipe_id`, `food_id`, `grams` |
| `favorite_food` | `user_id`, `food_id` |

### Registro diario
| Tabla | Campos principales |
|---|---|
| `meal_entry` | `id`, `user_id`, `eaten_at`, `meal_type` (desayuno, almuerzo, once, cena, colación) |
| `meal_item` | `id`, `meal_entry_id`, `food_id`, `quantity`, `unit` (g/ml/porción), `portion_id?`, `grams_resolved`, `kcal`, `protein_g`, `carb_g`, `fat_g` (**instantánea** al guardar) |
| `daily_summary` (vista) | `user_id`, `day`, `intake_kcal`, `bmr`, `activity_factor`, `steps_kcal`, `exercise_net_kcal`, `tdee_day`, `balance_kcal`, macros |

## Decisiones
- **Instantánea de nutrientes en `meal_item`:** si después se corrige o se reimporta un alimento, el historial no cambia.
- **Alimentos del usuario y públicos en la misma tabla** (`owner_user_id`): una sola búsqueda; la RLS filtra `owner_user_id IS NULL OR owner_user_id = auth.uid()`.
- **Fechas y horas con zona horaria** (`timestamptz`); el "día" se calcula con la zona horaria del perfil.
- **Búsqueda:** índice GIN `pg_trgm` sobre `unaccent(name_es)` más `tsvector` español.
- **Migraciones:** `supabase/migrations/` (la primera es el esquema inicial, con el seed de `nutrient` porque es dato de referencia en todos los entornos; el catálogo `activity_type` se carga en `20261119200000_seed_activity_type.sql`, con MET del Compendium 2011 y el código de cada fila en un comentario, de forma idempotente con `on conflict (code) do update`). Las pruebas de RLS están en `supabase/tests/` (pgTAP).
- **Valores cerrados con `CHECK` sobre `text`** en vez de enums, para ampliarlos sin migraciones complejas. Códigos: `sex` (male, female), `level` (bmr_only, sedentary, light, moderate, active, very_active, custom), `kcal_method` (hr, met, machine, manual), `meal_type` (desayuno, almuerzo, once, cena, colacion), `state` (crudo, cocido, na), `unit` (g, ml, portion).
- **RLS:** cada tabla de usuario filtra por `user_id = auth.uid()`; `meal_item` y `recipe_ingredient` heredan el permiso de su padre, y solo aceptan alimentos visibles para el usuario. `nutrient` y `activity_type` son de solo lectura; los alimentos públicos y los catálogos se escriben con la clave secreta (ETL), que omite la RLS. Las funciones de apoyo de la RLS viven en el esquema `private`, que la Data API no expone.
- **Porción coherente:** `meal_item (portion_id, food_id)` referencia a `food_portion (id, food_id)`, así la porción siempre es del mismo alimento. Si la porción se borra, el ítem conserva sus gramos resueltos.
- **Borrar la cuenta** (`auth.users`) elimina en cascada todos los datos del usuario, incluidos sus alimentos privados.
