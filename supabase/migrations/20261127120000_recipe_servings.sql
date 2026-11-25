-- Recetas propias (tarea #18, RF-20, HU-04).
--
-- Las tablas recipe y recipe_ingredient, sus GRANT y su RLS ya existen desde el esquema
-- inicial: la receta genera un alimento propio (food, source = 'recipe') con los
-- nutrientes por 100 g de la preparación cocida, y recipe_ingredient guarda los
-- ingredientes para poder editarla. Esta migración (no destructiva) agrega:
-- * servings: número de porciones de la receta, opcional. Si se informa, el alimento
--   generado tiene una food_portion de peso cocido / porciones gramos.
-- Las filas existentes quedan en null. No cambian GRANT ni políticas de RLS.

alter table public.recipe
  add column servings numeric(5, 1) check (servings > 0 and servings <= 100);

comment on column public.recipe.servings is
  'Número de porciones en que se divide el peso cocido; null si no se definió.';
