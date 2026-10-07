-- Scaffali personali: i sette generi restano riferimento condiviso, mentre nome e ordine sono per utente.
-- Additiva: non cambia genre_id sui libri e non modifica rating, bingo o relazioni.

begin;

create table public.user_genre_shelves (
  user_id uuid not null references app.users(id) on delete cascade,
  genre_id smallint not null references public.genres(id) on delete restrict,
  name text not null,
  sort_order smallint not null,
  primary key (user_id, genre_id),
  unique (user_id, sort_order),
  constraint user_genre_shelves_name_chk check (char_length(btrim(name)) between 1 and 80),
  constraint user_genre_shelves_sort_order_chk check (sort_order between 1 and 7)
);

create index user_genre_shelves_user_order_idx
  on public.user_genre_shelves (user_id, sort_order);

alter table public.user_genre_shelves enable row level security;
alter table public.user_genre_shelves force row level security;

create policy "users manage own genre shelves"
on public.user_genre_shelves
for all
to segnalibro_app
using (user_id = app.current_user_id())
with check (user_id = app.current_user_id());

-- Il valore di riferimento è sempre disponibile come fallback per utenti esistenti.
create or replace function private.user_genre_json(p_user_id uuid, p_genre_id smallint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'slug', g.slug,
    'name', coalesce(ugs.name, g.name_it)
  )
  from public.genres g
  left join public.user_genre_shelves ugs
    on ugs.user_id = p_user_id and ugs.genre_id = g.id
  where g.id = p_genre_id
$$;

-- Tutti i read model che contengono un libro riportano il nome dello scaffale dell'utente.
create or replace function private.contract_book_summary_json(
  p_user_id uuid,
  p_book_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', ub.id,
    'editionId', case when ub.edition_id is null then null else ub.edition_id::text end,
    'title', ub.title,
    'author', ub.author_display,
    'pageCount', ub.page_count,
    'language', ub.language,
    'format', ub.format,
    'source', ub.source,
    'genre', private.user_genre_json(p_user_id, ub.genre_id),
    'series', case when ub.series_name is null then null else jsonb_build_object(
      'name', ub.series_name,
      'number', ub.series_number,
      'total', ub.series_total
    ) end,
    'lifecycleState', ub.lifecycle_state,
    'completedReadingsCount', ub.completed_readings_count,
    'reviewRating', ub.review_rating,
    'lastFinishedAt', ub.last_finished_at,
    'lastActivityAt', ub.last_activity_at,
    'cover', jsonb_build_object(
      'coverUrl', ub.cover_url,
      'coverStoragePath', ub.cover_storage_path
    )
  )
  from public.user_books ub
  where ub.id = p_book_id and ub.user_id = p_user_id
$$;

create or replace function public.get_user_genre_shelves()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  return jsonb_build_object(
    'contractVersion', 1,
    'genres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'name', coalesce(ugs.name, g.name_it),
        'sortOrder', coalesce(ugs.sort_order, g.sort_order)
      ) order by coalesce(ugs.sort_order, g.sort_order), g.id)
      from public.genres g
      left join public.user_genre_shelves ugs
        on ugs.user_id = v_uid and ugs.genre_id = g.id
      where g.is_active
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_user_genre_shelves(p_genres jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_count integer;
  v_valid integer;
  v_distinct_slugs integer;
  v_distinct_orders integer;
begin
  if jsonb_typeof(p_genres) <> 'array' then
    raise exception 'Genres must be an array' using errcode = '22023';
  end if;

  select count(*),
         count(*) filter (where g.id is not null),
         count(distinct x.slug),
         count(distinct x.sort_order)
  into v_count, v_valid, v_distinct_slugs, v_distinct_orders
  from jsonb_to_recordset(p_genres) as x(slug text, name text, sort_order integer)
  left join public.genres g on g.slug = x.slug and g.is_active;

  if v_count <> 7 or v_valid <> 7 or v_distinct_slugs <> 7 or v_distinct_orders <> 7
     or exists (
       select 1 from jsonb_to_recordset(p_genres) as x(slug text, name text, sort_order integer)
       where nullif(btrim(x.name), '') is null
          or char_length(btrim(x.name)) > 80
          or x.sort_order not between 1 and 7
     ) then
    raise exception 'Expected the seven active genres with unique positions and names' using errcode = '22023';
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

-- Mantiene la firma e la forma del contratto esistenti; cambia soltanto le label e l'ordine delle shelf.
alter function public.get_library_home(integer) set schema private;
alter function private.get_library_home(integer) rename to contract_get_library_home_v1;

create function public.get_library_home(p_shelf_limit integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_home jsonb := private.contract_get_library_home_v1(p_shelf_limit);
begin
  return jsonb_set(
    v_home,
    '{shelves}',
    coalesce((
      select jsonb_agg(
        jsonb_set(
          shelf.value,
          '{genre}',
          private.user_genre_json(v_uid, (shelf.value #>> '{genre,id}')::smallint)
        )
        order by coalesce(ugs.sort_order, g.sort_order), g.id
      )
      from jsonb_array_elements(v_home->'shelves') shelf(value)
      join public.genres g on g.id = (shelf.value #>> '{genre,id}')::smallint
      left join public.user_genre_shelves ugs on ugs.user_id = v_uid and ugs.genre_id = g.id
    ), '[]'::jsonb)
  );
end;
$$;

alter function public.get_shelf_page(text, timestamptz, uuid, integer) set schema private;
alter function private.get_shelf_page(text, timestamptz, uuid, integer) rename to contract_get_shelf_page_v1;

create function public.get_shelf_page(
  p_genre_slug text,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_page jsonb := private.contract_get_shelf_page_v1(p_genre_slug, p_cursor_created_at, p_cursor_id, p_limit);
begin
  return jsonb_set(v_page, '{data,genre,name}', to_jsonb(coalesce((
    select ugs.name from public.user_genre_shelves ugs
    where ugs.user_id = v_uid and ugs.genre_id = (v_page #>> '{data,genre,id}')::smallint
  ), v_page #>> '{data,genre,name}')));
end;
$$;

alter function public.get_genre_view(text, text, text, integer, integer) set schema private;
alter function private.get_genre_view(text, text, text, integer, integer) rename to contract_get_genre_view_v1;

create function public.get_genre_view(
  p_genre_slug text,
  p_sort_field text default 'title',
  p_sort_direction text default 'asc',
  p_limit integer default 48,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_view jsonb := private.contract_get_genre_view_v1(p_genre_slug, p_sort_field, p_sort_direction, p_limit, p_offset);
begin
  return jsonb_set(v_view, '{genre,name}', to_jsonb(coalesce((
    select ugs.name from public.user_genre_shelves ugs
    where ugs.user_id = v_uid and ugs.genre_id = (v_view #>> '{genre,id}')::smallint
  ), v_view #>> '{genre,name}')));
end;
$$;

revoke execute on function public.get_user_genre_shelves() from public;
revoke execute on function public.update_user_genre_shelves(jsonb) from public;
revoke execute on function public.get_library_home(integer) from public;
revoke execute on function public.get_shelf_page(text, timestamptz, uuid, integer) from public;
revoke execute on function public.get_genre_view(text, text, text, integer, integer) from public;

revoke execute on all functions in schema private from public, segnalibro_app;

grant select, insert, update, delete on public.user_genre_shelves to segnalibro_app;
grant execute on function public.get_user_genre_shelves() to segnalibro_app;
grant execute on function public.update_user_genre_shelves(jsonb) to segnalibro_app;
grant execute on function public.get_library_home(integer) to segnalibro_app;
grant execute on function public.get_shelf_page(text, timestamptz, uuid, integer) to segnalibro_app;
grant execute on function public.get_genre_view(text, text, text, integer, integer) to segnalibro_app;

commit;
