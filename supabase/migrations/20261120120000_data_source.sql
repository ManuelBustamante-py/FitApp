-- Catálogo de fuentes de datos de alimentos y su atribución.
--
-- food.source / food.license guardan la trazabilidad por fila; esta tabla guarda
-- el texto de atribución que la app debe mostrar por fuente (p. ej. la ODbL de
-- Open Food Facts exige atribuir y compartir igual la base derivada).
-- Datos de referencia públicos: lectura para authenticated; sin políticas de
-- escritura (se mantienen por migración).

create table public.data_source (
  source text primary key check (source ~ '^[a-z0-9_]+$'), -- mismo valor que food.source
  name text not null,
  license text not null,
  attribution text not null,
  url text
);

comment on table public.data_source is 'Fuentes de alimentos importadas y el texto de atribución que exige su licencia.';

alter table public.data_source enable row level security;

create policy "data_source: leer" on public.data_source
  for select to authenticated
  using (true);

grant select on table public.data_source to authenticated;

insert into public.data_source (source, name, license, attribution, url) values
  (
    'off',
    'Open Food Facts',
    'ODbL 1.0 (Open Food Facts)',
    'Contiene información de Open Food Facts, disponible bajo la Open Database License (ODbL).',
    'https://world.openfoodfacts.org'
  ),
  (
    'usda_fdc',
    'USDA FoodData Central (Foundation y SR Legacy)',
    'CC0 / dominio público',
    'Datos de USDA FoodData Central (dominio público, CC0).',
    'https://fdc.nal.usda.gov'
  ),
  (
    'usda_fndds',
    'USDA FoodData Central (FNDDS)',
    'CC0 / dominio público',
    'Datos de USDA FoodData Central (FNDDS, dominio público, CC0).',
    'https://fdc.nal.usda.gov'
  );
