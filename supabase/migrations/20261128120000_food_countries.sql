-- País del usuario y países de los productos (tarea #41).
--
-- Migración no destructiva (no borra ni reescribe datos):
-- * food.countries: países donde se vende el producto (ISO 3166-1 alfa-2 en mayúsculas,
--   p. ej. {CL,PE}). Lo llena el ETL de Open Food Facts con los países de LatAm de
--   countries_tags; queda en null para USDA, alimentos propios y recetas. Índice GIN
--   para consultas por país (countries @> '{CL}').
-- * profile.country: país del usuario (ISO alfa-2). null = no elegido; la app lo
--   resuelve con la IP o la zona horaria y, si no, usa Chile.
-- * search_food gana el parámetro user_country (por defecto null: país del perfil o
--   'CL'). Dentro de cada nivel de relevancia ordena primero los alimentos del país del
--   usuario y los sin país (genéricos USDA, propios, recetas) y después los de otros
--   países; no filtra ninguno. Como cambia la lista de argumentos se reemplaza la
--   función (drop + create): los llamadores con (q, max_results) siguen funcionando.
--
-- Los GRANT de tabla de profile y food ya cubren las columnas nuevas y las políticas de
-- RLS no cambian.

alter table public.food
  add column countries text[]
    constraint food_countries_iso_check check (
      countries is null
      or (
        cardinality(countries) > 0
        and array_position(countries, null) is null
        and array_to_string(countries, ',') ~ '^[A-Z]{2}(,[A-Z]{2})*$'
      )
    );

comment on column public.food.countries is
  'Países del producto (ISO 3166-1 alfa-2, mayúsculas); null = sin país (USDA, propios, recetas).';

create index food_countries_idx on public.food using gin (countries)
  where countries is not null;

alter table public.profile
  add column country text
    constraint profile_country_iso_check check (country ~ '^[A-Z]{2}$');

comment on column public.profile.country is
  'País del usuario (ISO 3166-1 alfa-2) para priorizar productos; null = no elegido (se usa la IP o Chile).';

drop function public.search_food(text, integer);

create function public.search_food(
  q text,
  max_results integer default 30,
  user_country text default null
)
returns table (
  id uuid,
  name_es text,
  name_en text,
  brand text,
  category text,
  source text,
  basis text,
  barcode text,
  owner_user_id uuid,
  kcal_per_100 numeric,
  score real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  qn text := lower(public.f_unaccent(btrim(coalesce(q, ''))));
  lim integer := least(greatest(coalesce(max_results, 30), 1), 100);
  uc text := upper(btrim(coalesce(user_country, '')));
  pattern text;
begin
  if char_length(qn) < 2 then
    return;
  end if;

  -- País: el recibido; si no es válido, el del perfil (RLS: solo el propio); si no, Chile.
  if uc !~ '^[A-Z]{2}$' then
    select p.country into uc from public.profile p where p.user_id = auth.uid();
    uc := coalesce(uc, 'CL');
  end if;

  if qn ~ '^[0-9]{6,14}$' then
    return query
      select f.id, f.name_es, f.name_en, f.brand, f.category, f.source, f.basis, f.barcode,
             f.owner_user_id,
             (select fn.amount_per_100
                from public.food_nutrient fn
               where fn.food_id = f.id
                 and fn.nutrient_id = (select n.id from public.nutrient n where n.code = 'energy_kcal')),
             1::real
        from public.food f
       where f.barcode = qn
       order by (f.owner_user_id is not null) desc,
                (f.countries is not null and not (uc = any (f.countries))),
                f.name_es
       limit lim;
    return;
  end if;

  -- Tokens alfanuméricos en orden: "leche  descremada" -> %leche%descremada%
  pattern := '%' || array_to_string(
    array(select t from regexp_split_to_table(qn, '[^[:alnum:]]+') as t where t <> ''),
    '%'
  ) || '%';

  return query
  with candidate as (
    select f.*,
           lower(public.f_unaccent(f.name_es)) as name_norm
      from public.food f
     where public.f_unaccent(f.name_es) ilike pattern
        or qn operator(extensions.<%) public.f_unaccent(f.name_es)
        or public.f_unaccent(f.name_en) ilike pattern
        or public.f_unaccent(f.brand) ilike pattern
  ),
  prioritized as (
    select c.*,
           case
             when c.owner_user_id is not null then 0
             when c.source = 'cl_inta' then 1
             when c.source = 'usda_fdc' then 2
             when c.source = 'usda_fndds' then 3
             when c.source = 'off' then 4
             when c.source = 'usda_branded' then 5
             else 6
           end as source_rank,
           -- 0 = del país del usuario o sin país; 1 = de otro país (respaldo).
           case
             when c.countries is null or uc = any (c.countries) then 0
             else 1
           end as country_rank
      from candidate c
  ),
  deduped as (
    select distinct on (
             p.name_norm,
             coalesce(lower(public.f_unaccent(p.brand)), ''),
             case when p.source = 'off' then coalesce(p.barcode, p.id::text) else '' end
           )
           p.*
      from prioritized p
     order by p.name_norm,
              coalesce(lower(public.f_unaccent(p.brand)), ''),
              case when p.source = 'off' then coalesce(p.barcode, p.id::text) else '' end,
              p.source_rank, p.id
  ),
  ranked as (
    select d.*,
           case
             when d.name_norm = qn then 0
             when d.name_norm like qn || '%' then 1
             when d.name_norm like pattern then 2
             else 3
           end as tier,
           extensions.word_similarity(qn, d.name_norm) as sim
      from deduped d
  ),
  top as (
    select r.*
      from ranked r
     order by r.tier, r.country_rank, r.source_rank, r.sim desc, char_length(r.name_es), r.name_es
     limit lim
  )
  select t.id, t.name_es, t.name_en, t.brand, t.category, t.source, t.basis, t.barcode,
         t.owner_user_id,
         (select fn.amount_per_100
            from public.food_nutrient fn
           where fn.food_id = t.id
             and fn.nutrient_id = (select n.id from public.nutrient n where n.code = 'energy_kcal')),
         t.sim::real
    from top t
   order by t.tier, t.country_rank, t.source_rank, t.sim desc, char_length(t.name_es), t.name_es;
end;
$$;

comment on function public.search_food(text, integer, text) is
  'Búsqueda de alimentos visibles para el usuario (pg_trgm + unaccent), deduplicada y ordenada por relevancia, país del usuario (los de otros países al final de cada nivel) y prioridad de fuente.';

revoke all on function public.search_food(text, integer, text) from public, anon;
grant execute on function public.search_food(text, integer, text) to authenticated;
