-- Pruebas de RLS del esquema inicial (pgTAP). Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- ---------------------------------------------------------------------
-- Datos de prueba (como postgres, que omite la RLS)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.food (id, name_es, source, source_id) values
  ('10000000-0000-0000-0000-000000000001', 'Plátano crudo', 'usda_fdc', 'test-1');
insert into public.food_portion (id, food_id, label_es, grams) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1 unidad mediana', 118);
insert into public.activity_type (code, name_es, met, category) values ('test_bike', 'Bicicleta', 7, 'cardio');

-- Helpers para actuar como un usuario autenticado.
create function pg_temp.login(uid uuid) returns void language sql as $$
  -- Se fijan ambas formas de los claims: auth.uid() lee una u otra según la versión de Auth.
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', uid::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
  select set_config('request.jwt.claim.sub', '', true);
$$;

-- ---------------------------------------------------------------------
-- Usuario A crea sus datos
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into public.profile (user_id, sex, birth_date, height_cm)
     values ('00000000-0000-0000-0000-00000000000a', 'male', '2003-01-01', 178) $$,
  'A crea su perfil'
);
select lives_ok(
  $$ insert into public.food (id, name_es, source, owner_user_id)
     values ('10000000-0000-0000-0000-00000000000a', 'Cazuela de A', 'user', '00000000-0000-0000-0000-00000000000a') $$,
  'A crea un alimento privado'
);
select lives_ok(
  $$ insert into public.meal_entry (id, user_id, eaten_at, meal_type)
     values ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', now(), 'almuerzo') $$,
  'A registra una comida'
);
select lives_ok(
  $$ insert into public.meal_item (meal_entry_id, food_id, quantity, unit, portion_id, grams_resolved, kcal)
     values ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 1, 'portion',
             '20000000-0000-0000-0000-000000000001', 118, 105) $$,
  'A agrega un alimento público por porción'
);
select throws_ok(
  $$ insert into public.meal_item (meal_entry_id, food_id, quantity, unit, portion_id, grams_resolved, kcal)
     values ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 1, 'portion',
             '20000000-0000-0000-0000-000000000001', 118, 105) $$,
  '23503', null,
  'La porción debe ser del mismo alimento'
);
select is((select count(*) from public.food)::int, 2, 'A ve el alimento público y el suyo');
select is((select count(*) from public.nutrient)::int, 11, 'A lee el catálogo de nutrientes');

-- ---------------------------------------------------------------------
-- Usuario B no ve ni toca lo de A
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

select is_empty('select * from public.profile', 'B no ve el perfil de A');
select is_empty('select * from public.meal_entry', 'B no ve las comidas de A');
select is_empty('select * from public.meal_item', 'B no ve los ítems de A');
select is((select count(*) from public.food)::int, 1, 'B solo ve el alimento público');

select throws_ok(
  $$ insert into public.profile (user_id, sex, birth_date, height_cm)
     values ('00000000-0000-0000-0000-00000000000a', 'female', '2000-01-01', 160) $$,
  '42501', null,
  'B no puede crear datos a nombre de A'
);
select throws_ok(
  $$ insert into public.meal_item (meal_entry_id, food_id, quantity, unit, grams_resolved, kcal)
     values ('30000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 100, 'g', 100, 89) $$,
  '42501', null,
  'B no puede agregar ítems a la comida de A'
);
select throws_ok(
  $$ insert into public.food (name_es, source) values ('Público falso', 'user') $$,
  '42501', null,
  'B no puede crear alimentos públicos'
);

select lives_ok(
  $$ insert into public.meal_entry (id, user_id, eaten_at, meal_type)
     values ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', now(), 'cena') $$,
  'B registra su propia comida'
);
select throws_ok(
  $$ insert into public.meal_item (meal_entry_id, food_id, quantity, unit, grams_resolved, kcal)
     values ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a', 100, 'g', 100, 80) $$,
  '42501', null,
  'B no puede usar el alimento privado de A'
);
select throws_ok(
  $$ insert into public.favorite_food (user_id, food_id)
     values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a') $$,
  '42501', null,
  'B no puede marcar como favorito el alimento privado de A'
);

update public.food set name_es = 'Hackeado' where id = '10000000-0000-0000-0000-000000000001';
select is(
  (select name_es from public.food where id = '10000000-0000-0000-0000-000000000001'),
  'Plátano crudo',
  'B no puede editar alimentos públicos'
);

-- ---------------------------------------------------------------------
-- Anónimo y búsqueda
-- ---------------------------------------------------------------------
select pg_temp.logout();
set local role anon;
select is_empty('select * from public.nutrient', 'Un visitante anónimo no lee nada');
reset role;

select ok(
  exists (select 1 from public.food where public.f_unaccent(name_es) ilike '%platano%'),
  'La búsqueda ignora tildes'
);
select ok(
  exists (select 1 from public.food where search_vector @@ plainto_tsquery('spanish', 'platanos')),
  'El texto completo en español encuentra plurales'
);

-- ---------------------------------------------------------------------
-- Borrar la cuenta elimina sus datos en cascada (RNF-06)
-- ---------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select ok(
  not exists (select 1 from public.profile where user_id = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.food where owner_user_id = '00000000-0000-0000-0000-00000000000a')
  and not exists (select 1 from public.meal_entry where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Borrar la cuenta elimina perfil, alimentos privados y comidas'
);

select * from finish();
rollback;
