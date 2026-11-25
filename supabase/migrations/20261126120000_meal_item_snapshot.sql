-- Registro de comidas: instantánea completa de nutrientes (tarea #16, RF-16..18).
--
-- meal_item ya guarda kcal, proteínas, carbohidratos y grasas como instantánea.
-- Esta migración (no destructiva) agrega:
-- * nutrients: todos los nutrientes disponibles del alimento escalados a la cantidad
--   registrada, como objeto { código de public.nutrient: cantidad }. Un nutriente que
--   el alimento no informa no aparece (≠ 0). Se calcula en el servidor al registrar y
--   no se recalcula si el alimento cambia después.
-- * kcal_estimated: true si el alimento no informa energía y las kcal se estimaron
--   con 4·P + 4·C + 9·G + 7·alcohol (docs/03 §5).
--
-- Las filas existentes quedan con '{}' y false. No cambian los GRANT ni la RLS:
-- son columnas nuevas de una tabla que ya tiene privilegios para authenticated y la
-- política "meal_item: del registro propio".

alter table public.meal_item
  add column nutrients jsonb not null default '{}'::jsonb,
  add column kcal_estimated boolean not null default false;

alter table public.meal_item
  add constraint meal_item_nutrients_object check (jsonb_typeof(nutrients) = 'object');

comment on column public.meal_item.nutrients is
  'Instantánea de nutrientes escalados a la cantidad registrada: { código de nutrient: cantidad }.';
comment on column public.meal_item.kcal_estimated is
  'true si las kcal se estimaron desde los macronutrientes porque el alimento no informa energía.';
