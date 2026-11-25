-- Privilegios de tabla para el rol service_role (cargas ETL de USDA y Open Food Facts).
--
-- El proyecto no concede privilegios por defecto sobre tablas nuevas de `public`
-- (ver 20261119190000_grants_authenticated.sql), así que los scripts de
-- scripts/ingest, que usan la clave secreta (service_role, omite la RLS),
-- fallaban con "permission denied for table nutrient". Solo se conceden las
-- tablas del catálogo de alimentos que escriben esos scripts.

grant select, insert, update, delete on table
  public.food,
  public.food_nutrient,
  public.food_portion
to service_role;

grant select on table
  public.nutrient,
  public.data_source
to service_role;
