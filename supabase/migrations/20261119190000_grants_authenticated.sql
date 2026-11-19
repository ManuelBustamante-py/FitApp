-- Privilegios de tabla para el rol authenticated.
--
-- El proyecto no concede privilegios por defecto sobre tablas nuevas de `public`,
-- así que sin estos GRANT cualquier consulta con sesión falla con
-- "permission denied" antes de evaluar RLS. RLS sigue limitando qué filas ve
-- y modifica cada usuario; anon no recibe ningún privilegio.

-- Datos propios del usuario (políticas "for all").
grant select, insert, update, delete on table
  public.profile,
  public.activity_schedule,
  public.daily_activity,
  public.goal,
  public.body_measurement,
  public.workout_session,
  public.workout_template,
  public.meal_entry,
  public.meal_item,
  public.favorite_food,
  public.recipe,
  public.recipe_ingredient,
  public.food,
  public.food_nutrient,
  public.food_portion
to authenticated;

-- Catálogos de solo lectura.
grant select on table
  public.nutrient,
  public.activity_type
to authenticated;
