-- Genere Saggi: categoria autonoma, con palette e dimensioni di recensione dedicate.
-- I dati dei sette generi esistenti e le personalizzazioni utente restano intatti.

begin;

insert into public.genres (id, slug, name_it, sort_order)
values (8, 'essays', 'Saggi', 8)
on conflict (id) do nothing;

insert into public.rating_dimensions
  (dimension_key, genre_id, label_it, sort_order, version, is_active)
values
  ('essays.clarity', 8, 'Chiarezza', 1, 1, true),
  ('essays.depth',   8, 'Approfondimento', 2, 1, true),
  ('essays.rigor',   8, 'Rigore', 3, 1, true),
  ('essays.style',   8, 'Stile', 4, 1, true),
  ('essays.impact',  8, 'Impatto', 5, 1, true)
on conflict (dimension_key) do update set
  genre_id = excluded.genre_id,
  label_it = excluded.label_it,
  sort_order = excluded.sort_order,
  version = excluded.version,
  is_active = excluded.is_active;

alter table public.user_genre_shelves
  drop constraint user_genre_shelves_sort_order_chk;

alter table public.user_genre_shelves
  add constraint user_genre_shelves_sort_order_chk
  check (sort_order between 1 and 8);

create or replace function public.update_user_genre_shelves(p_genres jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_expected integer;
  v_count integer;
  v_valid integer;
  v_distinct_slugs integer;
  v_distinct_orders integer;
begin
  if jsonb_typeof(p_genres) <> 'array' then
    raise exception 'Genres must be an array' using errcode = '22023';
  end if;

  select count(*)
  into v_expected
  from public.genres
  where is_active;

  select count(*),
         count(*) filter (where g.id is not null),
         count(distinct x.slug),
         count(distinct x.sort_order)
  into v_count, v_valid, v_distinct_slugs, v_distinct_orders
  from jsonb_to_recordset(p_genres) as x(slug text, name text, sort_order integer)
  left join public.genres g on g.slug = x.slug and g.is_active;

  if v_count <> v_expected
     or v_valid <> v_expected
     or v_distinct_slugs <> v_expected
     or v_distinct_orders <> v_expected
     or exists (
       select 1
       from jsonb_to_recordset(p_genres) as x(slug text, name text, sort_order integer)
       where nullif(btrim(x.name), '') is null
          or char_length(btrim(x.name)) > 80
          or x.sort_order not between 1 and v_expected
     ) then
    raise exception 'Expected all active genres with unique positions and names' using errcode = '22023';
  end if;

  insert into public.user_genre_shelves (user_id, genre_id, name, sort_order)
  select v_uid, g.id, btrim(x.name), x.sort_order::smallint
  from jsonb_to_recordset(p_genres) as x(slug text, name text, sort_order integer)
  join public.genres g on g.slug = x.slug and g.is_active
  on conflict (user_id, genre_id) do update
    set name = excluded.name, sort_order = excluded.sort_order;

  return public.get_user_genre_shelves();
end;
$$;

commit;
