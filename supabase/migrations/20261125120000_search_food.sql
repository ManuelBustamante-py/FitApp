-- Búsqueda de alimentos (tarea #15, RF-15, RNF-04).
--
-- public.search_food(q, max_results):
-- * security invoker: corre con los permisos de quien llama, así la RLS de food
--   (públicos + propios) y de food_nutrient se aplica sola.
-- * Normaliza la consulta con lower(f_unaccent(...)) y descarta menos de 2 caracteres.
-- * Si q son 6 a 14 dígitos, busca por código de barras exacto (food_barcode_idx).
-- * Candidatos: coincidencia por subcadena (ilike '%t1%t2%', tokens en orden) o por
--   similitud de palabra (operador <% de pg_trgm, umbral por defecto 0,6) sobre name_es;
--   ilike sobre name_en y brand.
-- * Deduplicación: una fila por (name_es normalizado, marca; en OFF también código de
--   barras) con distinct on, prefiriendo la fuente de mayor prioridad
--   (docs/04: usuario > tabla chilena > USDA SR/Foundation > FNDDS > OFF > Branded).
--   No se borra ningún dato.
-- * Orden final: relevancia (exacto, prefijo, contiene, difuso), luego prioridad de
--   fuente, luego similitud y largo del nombre.
--
-- Por qué usa índices (RNF-04, p95 < 300 ms): las expresiones de la consulta son
-- idénticas a las de los índices GIN (f_unaccent(name_es), f_unaccent(name_en),
-- f_unaccent(brand) con gin_trgm_ops), y ilike y <% son operadores que gin_trgm_ops
-- soporta; el planner combina las ramas con BitmapOr. El resultado se limita a
-- max_results (30 por defecto, tope 100) y los kcal se consultan solo para esas filas
-- por la clave primaria de food_nutrient. Con 2 caracteres no hay trigramas completos
-- y Postgres puede recorrer la tabla: es el costo aceptado del mínimo de 2 caracteres.

create index food_name_en_trgm_idx
  on public.food using gin (public.f_unaccent(name_en) extensions.gin_trgm_ops)
  where name_en is not null;
create index food_brand_trgm_idx
  on public.food using gin (public.f_unaccent(brand) extensions.gin_trgm_ops)
  where brand is not null;

create or replace function public.search_food(q text, max_results integer default 30)
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
  pattern text;
begin
  if char_length(qn) < 2 then
    return;
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
       order by (f.owner_user_id is not null) desc, f.name_es
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
           end as source_rank
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
     order by r.tier, r.source_rank, r.sim desc, char_length(r.name_es), r.name_es
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
   order by t.tier, t.source_rank, t.sim desc, char_length(t.name_es), t.name_es;
end;
$$;

comment on function public.search_food(text, integer) is
  'Búsqueda de alimentos visibles para el usuario (pg_trgm + unaccent), deduplicada y ordenada por relevancia y prioridad de fuente.';

revoke all on function public.search_food(text, integer) from public, anon;
grant execute on function public.search_food(text, integer) to authenticated;
