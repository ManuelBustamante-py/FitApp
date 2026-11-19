-- FitApp · Esquema inicial (tarea #5)
-- Referencias: docs/06-modelo-de-datos.md y docs/uml/modelo-er.puml.
--
-- Convenciones:
-- * Los valores cerrados se validan con CHECK sobre text (más fácil de ampliar que un enum).
-- * Toda tabla de usuario tiene RLS con políticas por user_id; las tablas hijas
--   (meal_item, recipe_ingredient, food_nutrient, food_portion) heredan el permiso del padre.
-- * auth.uid() se envuelve en (select auth.uid()) para que Postgres lo evalúe una sola vez por consulta.
-- * Borrar la cuenta (auth.users) elimina en cascada todos los datos del usuario (RNF-06).
-- * Las tablas de referencia (nutrient, activity_type) y los alimentos públicos se escriben
--   con la clave secreta (ETL/seed), que omite la RLS; los usuarios solo los leen.

-- =====================================================================
-- Extensiones y funciones de apoyo
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() no es IMMUTABLE (depende del diccionario configurado), así que no sirve
-- para índices ni columnas generadas. Este envoltorio fija el diccionario y sí lo es.
create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

-- =====================================================================
-- Usuario
-- =====================================================================

create table public.profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null check (birth_date between date '1900-01-01' and current_date),
  height_cm numeric(5, 1) not null check (height_cm between 50 and 260),
  bmr_formula text not null default 'mifflin'
    check (bmr_formula in ('mifflin', 'harris_benedict', 'katch_mcardle', 'cunningham', 'measured')),
  bmr_measured_kcal numeric(6, 1) check (bmr_measured_kcal between 500 and 6000),
  sedentary_steps_threshold integer not null default 2500
    check (sedentary_steps_threshold between 0 and 20000),
  stride_m numeric(4, 3) check (stride_m between 0.3 and 1.5),
  timezone text not null default 'America/Santiago',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_measured_bmr_required
    check (bmr_formula <> 'measured' or bmr_measured_kcal is not null)
);

comment on table public.profile is 'Datos personales para TMB/TDEE; se crea en el onboarding.';
comment on column public.profile.sex is 'Sexo para las fórmulas (Mifflin, Harris-Benedict, Keytel).';

-- Nivel o pasos de cada día de la semana tipo.
create table public.activity_schedule (
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = lunes, 7 = domingo
  mode text not null check (mode in ('level', 'steps')),
  level text check (level in ('bmr_only', 'sedentary', 'light', 'moderate', 'active', 'very_active', 'custom')),
  custom_factor numeric(4, 3) check (custom_factor between 1 and 2.5),
  steps_target integer check (steps_target between 0 and 100000),
  primary key (user_id, weekday),
  constraint activity_schedule_mode_fields check (
    (mode = 'level' and level is not null and steps_target is null)
    or (mode = 'steps' and steps_target is not null and level is null)
  ),
  constraint activity_schedule_custom_factor check ((level = 'custom') = (custom_factor is not null))
);

-- Ajuste de una fecha puntual; reemplaza a la semana tipo ese día.
create table public.daily_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  mode text not null check (mode in ('level', 'steps')),
  level text check (level in ('bmr_only', 'sedentary', 'light', 'moderate', 'active', 'very_active', 'custom')),
  custom_factor numeric(4, 3) check (custom_factor between 1 and 2.5),
  steps_actual integer check (steps_actual between 0 and 100000),
  primary key (user_id, day),
  constraint daily_activity_mode_fields check (
    (mode = 'level' and level is not null and steps_actual is null)
    or (mode = 'steps' and steps_actual is not null and level is null)
  ),
  constraint daily_activity_custom_factor check ((level = 'custom') = (custom_factor is not null))
);

create table public.goal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_weight_kg numeric(5, 1) not null check (target_weight_kg between 30 and 300),
  target_bmi numeric(4, 1) check (target_bmi between 15 and 40),
  weekly_rate_kg numeric(3, 2) not null check (weekly_rate_kg between -1.5 and 1.5),
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Una sola meta activa por usuario.
create unique index goal_one_active_per_user on public.goal (user_id) where active;
create index goal_user_id_idx on public.goal (user_id);

create table public.body_measurement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index body_measurement_user_measured_idx on public.body_measurement (user_id, measured_at desc);

-- =====================================================================
-- Ejercicio
-- =====================================================================

-- Catálogo con valores MET (Compendium). El seed llega en la tarea #9.
create table public.activity_type (
  id integer generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name_es text not null,
  met numeric(4, 1) not null check (met between 1 and 25),
  category text not null check (category in ('cardio', 'strength', 'flexibility', 'sport', 'daily', 'other'))
);

create table public.workout_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type_id integer not null references public.activity_type (id),
  started_at timestamptz not null,
  duration_min numeric(5, 1) not null check (duration_min > 0 and duration_min <= 1440),
  distance_km numeric(6, 2) check (distance_km >= 0),
  machine_kcal numeric(6, 1) check (machine_kcal >= 0),
  hr_avg smallint check (hr_avg between 30 and 250),
  hr_min smallint check (hr_min between 30 and 250),
  hr_max smallint check (hr_max between 30 and 250),
  rpe smallint check (rpe between 1 and 10),
  kcal_hr numeric(6, 1) check (kcal_hr >= 0),
  kcal_met numeric(6, 1) check (kcal_met >= 0),
  kcal_selected numeric(6, 1) not null check (kcal_selected >= 0),
  kcal_method text not null check (kcal_method in ('hr', 'met', 'machine', 'manual')),
  kcal_net numeric(6, 1) not null,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  constraint workout_session_hr_order check (
    (hr_min is null or hr_avg is null or hr_min <= hr_avg)
    and (hr_max is null or hr_avg is null or hr_avg <= hr_max)
    and (hr_min is null or hr_max is null or hr_min <= hr_max)
  )
);

create index workout_session_user_started_idx on public.workout_session (user_id, started_at desc);
create index workout_session_activity_type_idx on public.workout_session (activity_type_id);

create table public.workout_template (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type_id integer not null references public.activity_type (id),
  name text not null check (char_length(name) between 1 and 80),
  duration_min numeric(5, 1) not null check (duration_min > 0 and duration_min <= 1440),
  created_at timestamptz not null default now()
);

create index workout_template_user_idx on public.workout_template (user_id);
create index workout_template_activity_type_idx on public.workout_template (activity_type_id);

-- =====================================================================
-- Alimentos
-- =====================================================================

create table public.food (
  id uuid primary key default gen_random_uuid(),
  name_es text not null check (char_length(name_es) between 1 and 200),
  name_en text,
  brand text,
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  category text,
  state text not null default 'na' check (state in ('crudo', 'cocido', 'na')),
  basis text not null default 'per_100g' check (basis in ('per_100g', 'per_100ml')),
  density_g_ml numeric(5, 3) check (density_g_ml > 0 and density_g_ml < 5),
  source text not null check (source ~ '^[a-z0-9_]+$'), -- p. ej. usda_fdc, usda_fndds, off, cl_inta, user, recipe
  source_id text,
  license text,
  owner_user_id uuid references auth.users (id) on delete cascade, -- null = público
  search_vector tsvector generated always as (
    to_tsvector(
      'spanish'::regconfig,
      public.f_unaccent(coalesce(name_es, '') || ' ' || coalesce(brand, ''))
    )
  ) stored,
  imported_at timestamptz not null default now()
);

comment on column public.food.owner_user_id is 'null = alimento público (importado); si no, privado del usuario.';

-- Upsert idempotente del ETL por fuente.
create unique index food_source_source_id_key on public.food (source, source_id) where source_id is not null;
create index food_owner_user_idx on public.food (owner_user_id) where owner_user_id is not null;
create index food_barcode_idx on public.food (barcode) where barcode is not null;
-- Búsqueda: trigramas (tolera errores de tipeo y prefijos) + texto completo en español.
create index food_name_trgm_idx on public.food using gin (public.f_unaccent(name_es) extensions.gin_trgm_ops);
create index food_search_vector_idx on public.food using gin (search_vector);

create table public.nutrient (
  id integer generated always as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name_es text not null,
  unit text not null check (unit in ('kcal', 'g', 'mg', 'µg')),
  sort_order smallint not null default 0
);

create table public.food_nutrient (
  food_id uuid not null references public.food (id) on delete cascade,
  nutrient_id integer not null references public.nutrient (id),
  amount_per_100 numeric(10, 3) not null check (amount_per_100 >= 0),
  primary key (food_id, nutrient_id)
);

create index food_nutrient_nutrient_idx on public.food_nutrient (nutrient_id);

create table public.food_portion (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.food (id) on delete cascade,
  label_es text not null check (char_length(label_es) between 1 and 80),
  grams numeric(7, 2) not null check (grams > 0),
  -- Permite que meal_item exija que la porción sea del mismo alimento.
  unique (id, food_id)
);

create index food_portion_food_idx on public.food_portion (food_id);

create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  cooked_weight_g numeric(8, 1) not null check (cooked_weight_g > 0),
  -- Alimento generado con los nutrientes por 100 g de la receta cocida.
  food_id uuid not null unique references public.food (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index recipe_user_idx on public.recipe (user_id);

create table public.recipe_ingredient (
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  food_id uuid not null references public.food (id),
  grams numeric(8, 1) not null check (grams > 0),
  primary key (recipe_id, food_id)
);

create index recipe_ingredient_food_idx on public.recipe_ingredient (food_id);

create table public.favorite_food (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.food (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create index favorite_food_food_idx on public.favorite_food (food_id);

-- =====================================================================
-- Registro diario
-- =====================================================================

create table public.meal_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null,
  meal_type text not null check (meal_type in ('desayuno', 'almuerzo', 'once', 'cena', 'colacion')),
  created_at timestamptz not null default now()
);

create index meal_entry_user_eaten_idx on public.meal_entry (user_id, eaten_at desc);

-- Los nutrientes se guardan como instantánea al registrar: corregir o reimportar
-- un alimento no cambia el historial.
create table public.meal_item (
  id uuid primary key default gen_random_uuid(),
  meal_entry_id uuid not null references public.meal_entry (id) on delete cascade,
  food_id uuid not null references public.food (id),
  quantity numeric(8, 2) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'ml', 'portion')),
  portion_id uuid,
  grams_resolved numeric(8, 1) not null check (grams_resolved > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carb_g numeric(6, 1) not null default 0 check (carb_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now(),
  constraint meal_item_portion_fk foreign key (portion_id, food_id)
    references public.food_portion (id, food_id) on delete set null (portion_id),
  -- Si la porción se borra después, el ítem conserva unit = 'portion' y sus gramos resueltos.
  constraint meal_item_portion_unit check (portion_id is null or unit = 'portion')
);

create index meal_item_entry_idx on public.meal_item (meal_entry_id);
create index meal_item_food_idx on public.meal_item (food_id);
create index meal_item_portion_idx on public.meal_item (portion_id) where portion_id is not null;

-- =====================================================================
-- updated_at
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profile enable row level security;
alter table public.activity_schedule enable row level security;
alter table public.daily_activity enable row level security;
alter table public.goal enable row level security;
alter table public.body_measurement enable row level security;
alter table public.activity_type enable row level security;
alter table public.workout_session enable row level security;
alter table public.workout_template enable row level security;
alter table public.food enable row level security;
alter table public.nutrient enable row level security;
alter table public.food_nutrient enable row level security;
alter table public.food_portion enable row level security;
alter table public.recipe enable row level security;
alter table public.recipe_ingredient enable row level security;
alter table public.favorite_food enable row level security;
alter table public.meal_entry enable row level security;
alter table public.meal_item enable row level security;

-- Funciones de apoyo de la RLS en un esquema que la Data API no expone (no son RPC públicas).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Visibilidad de un alimento: público o propio. SECURITY DEFINER evita que las políticas
-- de las tablas hijas vuelvan a evaluar la RLS de food en cada fila.
create or replace function private.can_read_food(target_food_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.food f
    where f.id = target_food_id
      and (f.owner_user_id is null or f.owner_user_id = (select auth.uid()))
  )
$$;

create or replace function private.owns_food(target_food_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.food f
    where f.id = target_food_id and f.owner_user_id = (select auth.uid())
  )
$$;

revoke all on function private.can_read_food(uuid) from public, anon;
revoke all on function private.owns_food(uuid) from public, anon;
grant execute on function private.can_read_food(uuid) to authenticated;
grant execute on function private.owns_food(uuid) to authenticated;

-- Tablas propias del usuario: acceso total a sus filas.
create policy "profile: propio" on public.profile
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "activity_schedule: propio" on public.activity_schedule
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "daily_activity: propio" on public.daily_activity
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "goal: propio" on public.goal
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "body_measurement: propio" on public.body_measurement
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "workout_session: propio" on public.workout_session
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "workout_template: propio" on public.workout_template
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "meal_entry: propio" on public.meal_entry
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Favoritos: solo de alimentos que el usuario puede ver.
create policy "favorite_food: propio" on public.favorite_food
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.can_read_food(food_id));

-- Recetas: el alimento generado debe ser del mismo usuario.
create policy "recipe: propio" on public.recipe
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.owns_food(food_id));

-- Ítems de comida: heredan del meal_entry y solo usan alimentos visibles.
create policy "meal_item: del registro propio" on public.meal_item
  for all to authenticated
  using (
    exists (
      select 1 from public.meal_entry e
      where e.id = meal_entry_id and e.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meal_entry e
      where e.id = meal_entry_id and e.user_id = (select auth.uid())
    )
    and private.can_read_food(food_id)
  );

-- Ingredientes: heredan de la receta y solo usan alimentos visibles.
create policy "recipe_ingredient: de receta propia" on public.recipe_ingredient
  for all to authenticated
  using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
    and private.can_read_food(food_id)
  );

-- Alimentos: se leen los públicos y los propios; solo se escriben los propios.
create policy "food: leer públicos y propios" on public.food
  for select to authenticated
  using (owner_user_id is null or owner_user_id = (select auth.uid()));

create policy "food: crear propios" on public.food
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "food: editar propios" on public.food
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy "food: borrar propios" on public.food
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- Nutrientes y porciones de un alimento: se leen si el alimento es visible
-- y se escriben si es propio.
create policy "food_nutrient: leer" on public.food_nutrient
  for select to authenticated
  using (private.can_read_food(food_id));

create policy "food_nutrient: escribir propios" on public.food_nutrient
  for all to authenticated
  using (private.owns_food(food_id))
  with check (private.owns_food(food_id));

create policy "food_portion: leer" on public.food_portion
  for select to authenticated
  using (private.can_read_food(food_id));

create policy "food_portion: escribir propios" on public.food_portion
  for all to authenticated
  using (private.owns_food(food_id))
  with check (private.owns_food(food_id));

-- Catálogos: solo lectura para usuarios con sesión.
create policy "nutrient: leer" on public.nutrient
  for select to authenticated
  using (true);

create policy "activity_type: leer" on public.activity_type
  for select to authenticated
  using (true);

-- =====================================================================
-- Seed: nutrientes (datos de referencia, necesarios en todos los entornos)
-- =====================================================================

insert into public.nutrient (code, name_es, unit, sort_order) values
  ('energy_kcal', 'Energía', 'kcal', 10),
  ('protein_g', 'Proteínas', 'g', 20),
  ('carb_g', 'Carbohidratos', 'g', 30),
  ('sugar_g', 'Azúcares totales', 'g', 40),
  ('fiber_g', 'Fibra dietética', 'g', 50),
  ('fat_g', 'Grasas totales', 'g', 60),
  ('fat_saturated_g', 'Grasas saturadas', 'g', 70),
  ('fat_trans_g', 'Grasas trans', 'g', 80),
  ('cholesterol_mg', 'Colesterol', 'mg', 90),
  ('sodium_mg', 'Sodio', 'mg', 100),
  ('alcohol_g', 'Alcohol', 'g', 110);
