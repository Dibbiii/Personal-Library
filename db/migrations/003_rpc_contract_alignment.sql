-- Segnalibro
-- Migration 003: stable RPC/API contract v1
--
-- Purpose:
--   * freeze the JSON boundary consumed by SvelteKit/Zod;
--   * keep SQL table details out of UI code;
--   * add contractVersion = 1 to every RPC response;
--   * normalize camelCase/null/[] semantics;
--   * preserve the proven transactional logic from migration 002 behind
--     private legacy functions while exposing contract-stable wrappers.
--
-- Requires migrations 001 (schema) and 002 (domain/RPC layer).

begin;

-- ============================================================================
-- 1. MOVE MIGRATION-002 RPCs BEHIND THE PUBLIC CONTRACT BOUNDARY
-- ============================================================================

alter function public.get_library_home(integer) set schema private;
alter function private.get_library_home(integer) rename to legacy_get_library_home;

alter function public.get_shelf_page(smallint, timestamptz, uuid, integer) set schema private;
alter function private.get_shelf_page(smallint, timestamptz, uuid, integer) rename to legacy_get_shelf_page;

alter function public.get_genre_view(smallint, text, text, integer, integer) set schema private;
alter function private.get_genre_view(smallint, text, text, integer, integer) rename to legacy_get_genre_view;

alter function public.get_book_detail(uuid) set schema private;
alter function private.get_book_detail(uuid) rename to legacy_get_book_detail;

alter function public.get_explore_pool(smallint[]) set schema private;
alter function private.get_explore_pool(smallint[]) rename to legacy_get_explore_pool;

alter function public.get_reading_calendar(integer) set schema private;
alter function private.get_reading_calendar(integer) rename to legacy_get_reading_calendar;

-- dashboard depends on public.get_year_stats by name at runtime; move it first.
alter function public.get_stats_dashboard(integer) set schema private;
alter function private.get_stats_dashboard(integer) rename to legacy_get_stats_dashboard;

alter function public.get_year_stats(integer) set schema private;
alter function private.get_year_stats(integer) rename to legacy_get_year_stats;

alter function public.get_bingo_board(integer) set schema private;
alter function private.get_bingo_board(integer) rename to legacy_get_bingo_board;

alter function public.queue_add(uuid, boolean) set schema private;
alter function private.queue_add(uuid, boolean) rename to legacy_queue_add;

alter function public.queue_remove(uuid) set schema private;
alter function private.queue_remove(uuid) rename to legacy_queue_remove;

alter function public.queue_move(uuid, integer) set schema private;
alter function private.queue_move(uuid, integer) rename to legacy_queue_move;

alter function public.start_reading(uuid, integer, timestamptz) set schema private;
alter function private.start_reading(uuid, integer, timestamptz) rename to legacy_start_reading;

alter function public.pause_reading(uuid) set schema private;
alter function private.pause_reading(uuid) rename to legacy_pause_reading;

alter function public.resume_reading(uuid) set schema private;
alter function private.resume_reading(uuid) rename to legacy_resume_reading;

alter function public.record_progress(uuid, uuid, integer, timestamptz, date) set schema private;
alter function private.record_progress(uuid, uuid, integer, timestamptz, date) rename to legacy_record_progress;

alter function public.correct_progress(uuid, uuid, integer, timestamptz, date) set schema private;
alter function private.correct_progress(uuid, uuid, integer, timestamptz, date) rename to legacy_correct_progress;

alter function public.finish_reading(uuid, uuid, integer, timestamptz, date) set schema private;
alter function private.finish_reading(uuid, uuid, integer, timestamptz, date) rename to legacy_finish_reading;

alter function public.mark_dnf(uuid, uuid, integer, timestamptz, date) set schema private;
alter function private.mark_dnf(uuid, uuid, integer, timestamptz, date) rename to legacy_mark_dnf;

alter function public.add_completed_reading(uuid, timestamptz, timestamptz, integer) set schema private;
alter function private.add_completed_reading(uuid, timestamptz, timestamptz, integer) rename to legacy_add_completed_reading;

alter function public.change_book_genre(uuid, smallint) set schema private;
alter function private.change_book_genre(uuid, smallint) rename to legacy_change_book_genre;

alter function public.save_review(uuid, smallint, text[], jsonb, smallint[]) set schema private;
alter function private.save_review(uuid, smallint, text[], jsonb, smallint[]) rename to legacy_save_review;


-- ============================================================================
-- 2. CONTRACT HELPERS
-- ============================================================================

create or replace function private.contract_genre_json(p_genre_id smallint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'slug', g.slug,
    'name', g.name_it
  )
  from public.genres g
  where g.id = p_genre_id;
$$;


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
    -- bigint IDs are strings at the JavaScript boundary.
    'editionId', case when ub.edition_id is null then null else ub.edition_id::text end,

    'title', ub.title,
    'author', ub.author_display,

    'pageCount', ub.page_count,
    'language', ub.language,

    'format', ub.format,
    'source', ub.source,

    'genre', private.contract_genre_json(ub.genre_id),

    'series', case
      when ub.series_name is null then null
      else jsonb_build_object(
        'name', ub.series_name,
        'number', ub.series_number,
        'total', ub.series_total
      )
    end,

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
  where ub.user_id = p_user_id
    and ub.id = p_book_id;
$$;


create or replace function private.contract_reading_json(
  p_user_id uuid,
  p_reading_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'userBookId', r.user_book_id,
    'status', r.status,
    'startedAt', r.started_at,
    'endedAt', r.ended_at,
    'startPage', r.start_page,
    'currentPage', r.current_page
  )
  from public.readings r
  where r.user_id = p_user_id
    and r.id = p_reading_id;
$$;


create or replace function private.contract_review_json(
  p_user_id uuid,
  p_user_book_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', rv.id,
    'userBookId', rv.user_book_id,
    'rating', rv.rating,
    'adjectives', to_jsonb(rv.adjectives),

    'scores', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'dimensionKey', rs.dimension_key,
            'label', rd.label_it,
            'score', rs.score
          )
          order by rd.sort_order, rd.dimension_key
        )
        from public.review_scores rs
        join public.rating_dimensions rd
          on rd.dimension_key = rs.dimension_key
        where rs.user_id = p_user_id
          and rs.review_id = rv.id
      ),
      '[]'::jsonb
    ),

    'tags', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'slug', t.slug,
            'label', t.label_it
          )
          order by t.sort_order, t.id
        )
        from public.user_book_tags ubt
        join public.tags t on t.id = ubt.tag_id
        where ubt.user_id = p_user_id
          and ubt.user_book_id = rv.user_book_id
      ),
      '[]'::jsonb
    ),

    'createdAt', rv.created_at,
    'updatedAt', rv.updated_at
  )
  from public.reviews rv
  where rv.user_id = p_user_id
    and rv.user_book_id = p_user_book_id;
$$;


create or replace function private.contract_queue_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'position', q.position,
        'addedAt', q.added_at,
        'book', private.contract_book_summary_json(p_user_id, q.user_book_id)
      )
      order by q.position
    ),
    '[]'::jsonb
  )
  from public.reading_queue q
  where q.user_id = p_user_id;
$$;


-- Improved progress-event write path.
-- A correction without an explicit local date is attributed to the latest
-- non-correction activity day for that reading. This avoids moving page totals
-- and yearly statistics to the day/year in which a typo happened to be fixed.
create or replace function private.apply_progress_event(
  p_event_id    uuid,
  p_reading_id  uuid,
  p_event_type  text,
  p_page        integer,
  p_occurred_at timestamptz,
  p_local_date  date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid              uuid := private.require_uid();
  v_existing         record;
  v_reading          record;
  v_local_date       date;
  v_timezone         text;
  v_delta            integer;
begin
  if p_event_id is null then
    raise exception 'event_id is required';
  end if;

  if p_page is null or p_page < 0 then
    raise exception 'page must be >= 0';
  end if;

  if p_event_type not in ('progress', 'correction', 'finish', 'dnf') then
    raise exception 'Unsupported progress event type';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text, 0)
  );

  select
    e.id,
    e.user_id,
    e.reading_id,
    e.event_type,
    e.page,
    e.page_delta,
    e.local_date,
    e.occurred_at
  into v_existing
  from public.reading_progress_events e
  where e.id = p_event_id;

  if found then
    if v_existing.user_id <> v_uid
       or v_existing.reading_id <> p_reading_id then
      raise exception 'event_id already exists' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'duplicate', true,
      'eventId', v_existing.id,
      'readingId', v_existing.reading_id,
      'eventType', v_existing.event_type,
      'page', v_existing.page,
      'pageDelta', v_existing.page_delta,
      'localDate', v_existing.local_date,
      'occurredAt', v_existing.occurred_at
    );
  end if;

  select
    r.id,
    r.user_book_id,
    r.status,
    r.current_page,
    r.start_page,
    r.ended_at
  into v_reading
  from public.readings r
  where r.id = p_reading_id
    and r.user_id = v_uid
  for update;

  if not found then
    raise exception 'Reading not found' using errcode = 'P0002';
  end if;

  if v_reading.ended_at is not null
     or v_reading.status in ('completed', 'dnf') then
    raise exception 'Reading is already closed' using errcode = '55000';
  end if;

  if p_event_type = 'progress' and v_reading.status <> 'active' then
    raise exception 'A progress update requires an active reading' using errcode = '55000';
  end if;

  if p_event_type in ('finish', 'dnf')
     and v_reading.status not in ('active', 'paused') then
    raise exception 'Reading cannot be closed from its current state' using errcode = '55000';
  end if;

  if p_event_type = 'correction' then
    v_delta := p_page - v_reading.current_page;
  else
    if p_page < v_reading.current_page then
      raise exception 'Page cannot move backwards; use correct_progress';
    end if;

    v_delta := p_page - v_reading.current_page;
  end if;

  if p_local_date is not null then
    v_local_date := p_local_date;

  elsif p_event_type = 'correction' then
    select e.local_date
      into v_local_date
    from public.reading_progress_events e
    where e.user_id = v_uid
      and e.reading_id = p_reading_id
      and e.event_type <> 'correction'
    order by e.occurred_at desc, e.created_at desc, e.id desc
    limit 1;
  end if;

  if v_local_date is null then
    select coalesce(p.timezone, 'UTC')
      into v_timezone
    from public.profiles p
    where p.id = v_uid;

    v_local_date := (
      coalesce(p_occurred_at, now())
      at time zone coalesce(v_timezone, 'UTC')
    )::date;
  end if;

  insert into public.reading_progress_events (
    id,
    user_id,
    reading_id,
    event_type,
    page,
    page_delta,
    local_date,
    occurred_at
  )
  values (
    p_event_id,
    v_uid,
    p_reading_id,
    p_event_type,
    p_page,
    v_delta,
    v_local_date,
    coalesce(p_occurred_at, now())
  );

  update public.readings r
  set
    current_page = p_page,
    status = case
      when p_event_type = 'finish' then 'completed'
      when p_event_type = 'dnf'    then 'dnf'
      else r.status
    end,
    ended_at = case
      when p_event_type in ('finish', 'dnf')
        then coalesce(p_occurred_at, now())
      else r.ended_at
    end
  where r.id = p_reading_id
    and r.user_id = v_uid;

  if v_delta > 0 then
    update public.user_books ub
    set last_activity_at = greatest(
      coalesce(ub.last_activity_at, '-infinity'::timestamptz),
      coalesce(p_occurred_at, now())
    )
    where ub.id = v_reading.user_book_id
      and ub.user_id = v_uid;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'eventId', p_event_id,
    'readingId', p_reading_id,
    'eventType', p_event_type,
    'page', p_page,
    'pageDelta', v_delta,
    'localDate', v_local_date,
    'occurredAt', coalesce(p_occurred_at, now())
  );
end;
$$;


-- ============================================================================
-- 3. READ MODELS — CONTRACT VERSION 1
-- ============================================================================

create or replace function public.get_library_home(
  p_shelf_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_legacy jsonb;
begin
  v_legacy := private.legacy_get_library_home(p_shelf_limit);

  return jsonb_build_object(
    'contractVersion', 1,

    'currentlyReading', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'book', private.contract_book_summary_json(
              v_uid,
              (item->>'bookId')::uuid
            ),
            'reading', jsonb_build_object(
              'id', (item->>'readingId')::uuid,
              'currentPage', (item->>'currentPage')::integer,
              'totalPages', case
                when item->>'pageCount' is null then null
                else (item->>'pageCount')::integer
              end,
              'progressPercent', case
                when item->>'percent' is null then null
                else (item->>'percent')::numeric
              end,
              'startedAt', (item->>'startedAt')::timestamptz,
              'paused', (item->>'readingStatus') = 'paused'
            )
          )
          order by ord
        )
        from jsonb_array_elements(v_legacy->'currentlyReading')
          with ordinality as x(item, ord)
      ),
      '[]'::jsonb
    ),

    'queue', private.contract_queue_json(v_uid),

    'shelves', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'genre', jsonb_build_object(
              'id', (shelf->>'genreId')::smallint,
              'slug', shelf->>'slug',
              'name', shelf->>'name'
            ),
            'totalCount', (shelf->>'totalCount')::integer,
            'hasMore', (shelf->>'hasMore')::boolean,
            'books', coalesce(
              (
                select jsonb_agg(
                  private.contract_book_summary_json(
                    v_uid,
                    (book->>'bookId')::uuid
                  )
                  order by book_ord
                )
                from jsonb_array_elements(shelf->'books')
                  with ordinality as b(book, book_ord)
              ),
              '[]'::jsonb
            )
          )
          order by shelf_ord
        )
        from jsonb_array_elements(v_legacy->'shelves')
          with ordinality as s(shelf, shelf_ord)
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.get_shelf_page(
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
  v_genre public.genres%rowtype;
  v_legacy jsonb;
begin
  select * into v_genre
  from public.genres g
  where g.slug = p_genre_slug
    and g.is_active;

  if not found then
    raise exception 'Genre not found' using errcode = 'P0002';
  end if;

  v_legacy := private.legacy_get_shelf_page(
    v_genre.id,
    p_cursor_created_at,
    p_cursor_id,
    p_limit
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'data', jsonb_build_object(
      'genre', private.contract_genre_json(v_genre.id),
      'books', coalesce(
        (
          select jsonb_agg(
            private.contract_book_summary_json(
              v_uid,
              (item->>'bookId')::uuid
            )
            order by ord
          )
          from jsonb_array_elements(v_legacy->'items')
            with ordinality as x(item, ord)
        ),
        '[]'::jsonb
      ),
      'hasMore', coalesce((v_legacy->>'hasMore')::boolean, false),
      'nextCursor', v_legacy->'nextCursor'
    )
  );
end;
$$;


create or replace function public.get_genre_view(
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
  v_genre public.genres%rowtype;
  v_legacy jsonb;
  v_sort_field text;
  v_sort_direction text;
begin
  select * into v_genre
  from public.genres g
  where g.slug = p_genre_slug
    and g.is_active;

  if not found then
    raise exception 'Genre not found' using errcode = 'P0002';
  end if;

  v_sort_field := case
    when p_sort_field in ('title', 'author', 'pages', 'rating', 'date')
      then p_sort_field
    else 'title'
  end;

  v_sort_direction := case
    when lower(p_sort_direction) = 'desc' then 'desc'
    else 'asc'
  end;

  v_legacy := private.legacy_get_genre_view(
    v_genre.id,
    v_sort_field,
    v_sort_direction,
    p_limit,
    p_offset
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'genre', private.contract_genre_json(v_genre.id),
    'counts', jsonb_build_object(
      'total', coalesce((v_legacy#>>'{counts,total}')::integer, 0),
      'read', coalesce((v_legacy#>>'{counts,read}')::integer, 0),
      'unread', coalesce((v_legacy#>>'{counts,unread}')::integer, 0)
    ),
    'sort', jsonb_build_object(
      'field', v_sort_field,
      'direction', v_sort_direction
    ),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'key', 'read',
        'count', coalesce((v_legacy#>>'{counts,read}')::integer, 0),
        'books', coalesce(
          (
            select jsonb_agg(
              private.contract_book_summary_json(
                v_uid,
                (item->>'bookId')::uuid
              )
              order by ord
            )
            from jsonb_array_elements(v_legacy->'items')
              with ordinality as x(item, ord)
            where item->>'section' = 'read'
          ),
          '[]'::jsonb
        )
      ),
      jsonb_build_object(
        'key', 'unread',
        'count', coalesce((v_legacy#>>'{counts,unread}')::integer, 0),
        'books', coalesce(
          (
            select jsonb_agg(
              private.contract_book_summary_json(
                v_uid,
                (item->>'bookId')::uuid
              )
              order by ord
            )
            from jsonb_array_elements(v_legacy->'items')
              with ordinality as x(item, ord)
            where item->>'section' = 'unread'
          ),
          '[]'::jsonb
        )
      )
    )
  );
end;
$$;


create or replace function public.get_book_detail(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_book jsonb;
  v_queue_position integer;
begin
  v_book := private.contract_book_summary_json(v_uid, p_book_id);

  if v_book is null then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  select q.position into v_queue_position
  from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_book_id;

  return jsonb_build_object(
    'contractVersion', 1,
    'book', v_book,
    'queuePosition', v_queue_position,

    'currentReading', (
      select private.contract_reading_json(v_uid, r.id)
      from public.readings r
      where r.user_id = v_uid
        and r.user_book_id = p_book_id
        and r.ended_at is null
      order by r.started_at desc, r.id desc
      limit 1
    ),

    'readings', coalesce(
      (
        select jsonb_agg(
          private.contract_reading_json(v_uid, x.id)
          || jsonb_build_object('sequence', x.sequence)
          order by x.started_at desc, x.id desc
        )
        from (
          select
            r.id,
            r.started_at,
            row_number() over (
              order by r.started_at asc, r.id asc
            )::integer as sequence
          from public.readings r
          where r.user_id = v_uid
            and r.user_book_id = p_book_id
        ) x
      ),
      '[]'::jsonb
    ),

    'review', private.contract_review_json(v_uid, p_book_id),

    'quotes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'userBookId', q.user_book_id,
            'body', q.body,
            'page', q.page,
            'createdAt', q.created_at,
            'updatedAt', q.updated_at
          )
          order by q.created_at desc, q.id desc
        )
        from public.quotes q
        where q.user_id = v_uid
          and q.user_book_id = p_book_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.get_explore_pool(
  p_genre_slugs text[] default null
)
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
    'books', coalesce(
      (
        select jsonb_agg(
          private.contract_book_summary_json(v_uid, ub.id)
          order by lower(ub.title), ub.id
        )
        from public.user_books ub
        join public.genres g on g.id = ub.genre_id
        where ub.user_id = v_uid
          -- Wheel chooses the next book: exclude current/paused/DNF/read books.
          and ub.lifecycle_state = 'unread'
          and (
            p_genre_slugs is null
            or cardinality(p_genre_slugs) = 0
            or g.slug = any(p_genre_slugs)
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.get_reading_calendar(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_year not between 1900 and 2200 then
    raise exception 'Invalid year';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'year', p_year,
    'days', coalesce(
      (
        with per_genre as (
          select
            e.local_date,
            ub.genre_id,
            greatest(sum(e.page_delta), 0)::integer as pages_read
          from public.reading_progress_events e
          join public.readings r
            on r.id = e.reading_id
           and r.user_id = e.user_id
          join public.user_books ub
            on ub.id = r.user_book_id
           and ub.user_id = e.user_id
          where e.user_id = v_uid
            and extract(year from e.local_date)::integer = p_year
          group by e.local_date, ub.genre_id
          having sum(e.page_delta) > 0
        ),
        per_day as (
          select
            pg.local_date,
            sum(pg.pages_read)::integer as pages_read,
            jsonb_agg(
              jsonb_build_object(
                'genre', private.contract_genre_json(pg.genre_id),
                'pagesRead', pg.pages_read
              )
              order by g.sort_order
            ) as genres
          from per_genre pg
          join public.genres g on g.id = pg.genre_id
          group by pg.local_date
        )
        select jsonb_agg(
          jsonb_build_object(
            'date', d.local_date,
            'pagesRead', d.pages_read,
            'genres', d.genres
          )
          order by d.local_date
        )
        from per_day d
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.get_year_stats(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_raw jsonb;
  v_reading_days integer;
begin
  if p_year not between 1900 and 2200 then
    raise exception 'Invalid year';
  end if;

  v_raw := private.legacy_get_year_stats(p_year);

  select count(distinct e.local_date)::integer
    into v_reading_days
  from public.reading_progress_events e
  where e.user_id = v_uid
    and e.page_delta > 0
    and extract(year from e.local_date)::integer = p_year;

  return jsonb_build_object(
    'contractVersion', 1,
    'stats', jsonb_build_object(
      'year', p_year,
      'booksFinished', coalesce((v_raw->>'completedReadings')::integer, 0),
      'pagesRead', greatest(coalesce((v_raw->>'pages')::integer, 0), 0),
      'readingDays', coalesce(v_reading_days, 0),
      'currentStreak', coalesce((v_raw#>>'{streak,current}')::integer, 0),
      'recordStreak', coalesce((v_raw#>>'{streak,record}')::integer, 0),

      'topGenre', case
        when v_raw->'topGenre' is null
          or v_raw->'topGenre' = 'null'::jsonb
        then null
        else jsonb_build_object(
          'genre', jsonb_build_object(
            'id', (v_raw#>>'{topGenre,genreId}')::smallint,
            'slug', v_raw#>>'{topGenre,slug}',
            'name', v_raw#>>'{topGenre,name}'
          ),
          'booksFinished', (v_raw#>>'{topGenre,count}')::integer
        )
      end,

      'topAuthor', case
        when v_raw->'topAuthor' is null
          or v_raw->'topAuthor' = 'null'::jsonb
        then null
        else jsonb_build_object(
          'name', v_raw#>>'{topAuthor,name}',
          'booksFinished', (v_raw#>>'{topAuthor,count}')::integer
        )
      end,

      'goldenMonth', case
        when v_raw->'bestMonth' is null
          or v_raw->'bestMonth' = 'null'::jsonb
        then null
        else jsonb_build_object(
          'month', (v_raw#>>'{bestMonth,month}')::integer,
          'booksFinished', (v_raw#>>'{bestMonth,count}')::integer
        )
      end,

      'topTags', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', (item->>'tagId')::integer,
              'slug', item->>'slug',
              'label', item->>'label',
              'count', (item->>'count')::integer
            )
            order by ord
          )
          from jsonb_array_elements(coalesce(v_raw->'topTags', '[]'::jsonb))
            with ordinality as x(item, ord)
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;


create or replace function public.get_stats_dashboard(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_stats jsonb;
begin
  v_stats := public.get_year_stats(p_year)->'stats';

  return jsonb_build_object(
    'contractVersion', 1,
    'stats', v_stats,

    'bingo', (
      select jsonb_build_object(
        'boardId', b.id,
        'year', b.year,
        'completedCount', count(c.id) filter (where c.completed_at is not null),
        'totalCount', 16
      )
      from public.bingo_boards b
      left join public.bingo_cells c
        on c.user_id = b.user_id
       and c.board_id = b.id
      where b.user_id = v_uid
        and b.year = p_year
      group by b.id, b.year
    ),

    'quotePreviews', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', x.id,
            'userBookId', x.user_book_id,
            'body', x.body,
            'page', x.page,
            'createdAt', x.created_at,
            'updatedAt', x.updated_at,
            'bookTitle', x.title,
            'author', x.author_display,
            'genre', private.contract_genre_json(x.genre_id)
          )
          order by x.created_at desc, x.id desc
        )
        from (
          select
            q.id,
            q.user_book_id,
            q.body,
            q.page,
            q.created_at,
            q.updated_at,
            ub.title,
            ub.author_display,
            ub.genre_id
          from public.quotes q
          join public.user_books ub
            on ub.id = q.user_book_id
           and ub.user_id = q.user_id
          where q.user_id = v_uid
          order by q.created_at desc, q.id desc
          limit 4
        ) x
      ),
      '[]'::jsonb
    ),

    'dnf', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'book', private.contract_book_summary_json(v_uid, x.book_id),
            'stoppedAtPage', case
              when x.current_page > 0 then x.current_page
              else null
            end,
            'dnfAt', x.ended_at
          )
          order by x.ended_at desc, x.book_id
        )
        from (
          select distinct on (ub.id)
            ub.id as book_id,
            r.current_page,
            r.ended_at
          from public.user_books ub
          join public.readings r
            on r.user_id = ub.user_id
           and r.user_book_id = ub.id
           and r.status = 'dnf'
          where ub.user_id = v_uid
            and ub.lifecycle_state = 'dnf'
            and ub.completed_readings_count = 0
          order by ub.id, r.ended_at desc
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.get_bingo_board(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_board public.bingo_boards%rowtype;
  v_cell_count integer;
begin
  select * into v_board
  from public.bingo_boards b
  where b.user_id = v_uid
    and b.year = p_year;

  if not found then
    raise exception 'Bingo board not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_cell_count
  from public.bingo_cells c
  where c.user_id = v_uid
    and c.board_id = v_board.id;

  if v_cell_count <> 16 then
    raise exception 'Bingo board must contain exactly 16 cells';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'board', jsonb_build_object(
      'id', v_board.id,
      'year', v_board.year,
      'title', v_board.title,
      'completedCount', (
        select count(*)::integer
        from public.bingo_cells c
        where c.user_id = v_uid
          and c.board_id = v_board.id
          and c.completed_at is not null
      ),
      'cells', (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'position', c.position,
            'challenge', c.challenge,
            'completedAt', c.completed_at,
            'book', case
              when c.user_book_id is null then null
              else private.contract_book_summary_json(v_uid, c.user_book_id)
            end
          )
          order by c.position
        )
        from public.bingo_cells c
        where c.user_id = v_uid
          and c.board_id = v_board.id
      )
    )
  );
end;
$$;


-- ============================================================================
-- 4. MUTATION CONTRACTS
-- ============================================================================

create or replace function public.queue_add(
  p_book_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_legacy jsonb;
  v_status text;
begin
  v_legacy := private.legacy_queue_add(p_book_id, p_force);

  v_status := case
    when coalesce((v_legacy->>'requiresConfirmation')::boolean, false)
      then 'requiresConfirmation'
    when coalesce((v_legacy->>'alreadyQueued')::boolean, false)
      then 'alreadyQueued'
    else 'added'
  end;

  return jsonb_build_object(
    'contractVersion', 1,
    'status', v_status,
    'currentCount', coalesce((v_legacy->>'count')::integer, 0),
    'position', case
      when v_legacy->>'position' is null then null
      else (v_legacy->>'position')::integer
    end,
    'queue', private.contract_queue_json(v_uid)
  );
end;
$$;


create or replace function public.queue_remove(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_queue_remove(p_book_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'queue', private.contract_queue_json(v_uid)
  );
end;
$$;


create or replace function public.queue_move(
  p_book_id uuid,
  p_new_position integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_queue_move(p_book_id, p_new_position);

  return jsonb_build_object(
    'contractVersion', 1,
    'queue', private.contract_queue_json(v_uid)
  );
end;
$$;


create or replace function public.start_reading(
  p_book_id uuid,
  p_started_at timestamptz default now(),
  p_start_page integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_legacy jsonb;
  v_reading_id uuid;
begin
  v_legacy := private.legacy_start_reading(
    p_book_id,
    p_start_page,
    coalesce(p_started_at, now())
  );

  v_reading_id := (v_legacy->>'readingId')::uuid;

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, v_reading_id),
    'duplicate', false
  );
end;
$$;


create or replace function public.pause_reading(p_reading_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_pause_reading(p_reading_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', false
  );
end;
$$;


create or replace function public.resume_reading(p_reading_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_resume_reading(p_reading_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', false
  );
end;
$$;


create or replace function public.record_progress(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_result jsonb;
begin
  v_result := private.legacy_record_progress(
    p_event_id,
    p_reading_id,
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', coalesce((v_result->>'duplicate')::boolean, false)
  );
end;
$$;


create or replace function public.correct_progress(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_result jsonb;
begin
  v_result := private.legacy_correct_progress(
    p_event_id,
    p_reading_id,
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', coalesce((v_result->>'duplicate')::boolean, false)
  );
end;
$$;


create or replace function public.finish_reading(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_result jsonb;
begin
  v_result := private.legacy_finish_reading(
    p_event_id,
    p_reading_id,
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', coalesce((v_result->>'duplicate')::boolean, false)
  );
end;
$$;


create or replace function public.mark_dnf(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_result jsonb;
begin
  v_result := private.legacy_mark_dnf(
    p_event_id,
    p_reading_id,
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, p_reading_id),
    'duplicate', coalesce((v_result->>'duplicate')::boolean, false)
  );
end;
$$;


create or replace function public.add_completed_reading(
  p_book_id uuid,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_final_page integer,
  p_start_page integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_legacy jsonb;
  v_reading_id uuid;
begin
  if p_start_page is null or p_start_page < 0 then
    raise exception 'start_page must be >= 0';
  end if;

  if p_final_page is null or p_final_page < p_start_page then
    raise exception 'final_page must be >= start_page';
  end if;

  -- Migration 002's historical helper always inserts with start_page = 0.
  -- We invoke it, then immediately set the explicit historical start page in
  -- the same transaction. This preserves all projection triggers/validation.
  v_legacy := private.legacy_add_completed_reading(
    p_book_id,
    p_started_at,
    p_finished_at,
    p_final_page
  );

  v_reading_id := (v_legacy->>'readingId')::uuid;

  update public.readings r
  set start_page = p_start_page
  where r.id = v_reading_id
    and r.user_id = v_uid;

  return jsonb_build_object(
    'contractVersion', 1,
    'reading', private.contract_reading_json(v_uid, v_reading_id),
    'duplicate', false
  );
end;
$$;


create or replace function public.change_book_genre(
  p_book_id uuid,
  p_genre_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_genre_id smallint;
  v_legacy jsonb;
begin
  select g.id into v_genre_id
  from public.genres g
  where g.slug = p_genre_slug
    and g.is_active;

  if not found then
    raise exception 'Genre not found' using errcode = 'P0002';
  end if;

  v_legacy := private.legacy_change_book_genre(p_book_id, v_genre_id);

  return jsonb_build_object(
    'contractVersion', 1,
    'book', private.contract_book_summary_json(v_uid, p_book_id),
    'reviewScoresReset', coalesce(
      (v_legacy->>'reviewScoresReset')::boolean,
      false
    )
  );
end;
$$;


create or replace function public.save_review(
  p_book_id uuid,
  p_rating smallint,
  p_adjectives text[],
  p_scores jsonb default '[]'::jsonb,
  p_tag_ids smallint[] default '{}'::smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_save_review(
    p_book_id,
    p_rating,
    p_adjectives,
    coalesce(p_scores, '[]'::jsonb),
    coalesce(p_tag_ids, '{}'::smallint[])
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'review', private.contract_review_json(v_uid, p_book_id)
  );
end;
$$;


-- ============================================================================
-- 5. BINGO MUTATION
-- ============================================================================

create or replace function public.assign_bingo_book(
  p_cell_id uuid,
  p_book_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_year integer;
begin
  select b.year into v_year
  from public.bingo_cells c
  join public.bingo_boards b
    on b.id = c.board_id
   and b.user_id = c.user_id
  where c.id = p_cell_id
    and c.user_id = v_uid
  for update of c;

  if not found then
    raise exception 'Bingo cell not found' using errcode = 'P0002';
  end if;

  if p_book_id is not null and not exists (
    select 1
    from public.user_books ub
    where ub.id = p_book_id
      and ub.user_id = v_uid
      and ub.completed_readings_count > 0
  ) then
    raise exception 'Bingo can only reference a completed book' using errcode = '55000';
  end if;

  update public.bingo_cells c
  set
    user_book_id = p_book_id,
    completed_at = case when p_book_id is null then null else now() end
  where c.id = p_cell_id
    and c.user_id = v_uid;

  return public.get_bingo_board(v_year);
end;
$$;


-- ============================================================================
-- 6. THEME SELECTION RPCs
-- ============================================================================
-- Built-in theme definitions stay in application source code. PostgreSQL only
-- stores the selected key or an owned custom_theme_id.

create or replace function public.get_theme_selection()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_pref public.user_preferences%rowtype;
begin
  select * into v_pref
  from public.user_preferences p
  where p.user_id = v_uid;

  if not found then
    raise exception 'Preferences not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'selection', case
      when v_pref.custom_theme_id is not null then
        jsonb_build_object(
          'kind', 'custom',
          'id', v_pref.custom_theme_id
        )
      else
        jsonb_build_object(
          'kind', 'builtin',
          'key', v_pref.theme_key
        )
    end
  );
end;
$$;


create or replace function public.set_theme_selection(
  p_kind text,
  p_key text default null,
  p_custom_theme_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_kind = 'builtin' then
    if p_key is null or btrim(p_key) = '' then
      raise exception 'Built-in theme key is required';
    end if;

    update public.user_preferences p
    set
      theme_key = p_key,
      custom_theme_id = null
    where p.user_id = v_uid;

  elsif p_kind = 'custom' then
    if p_custom_theme_id is null then
      raise exception 'custom_theme_id is required';
    end if;

    if not exists (
      select 1
      from public.custom_themes t
      where t.id = p_custom_theme_id
        and t.user_id = v_uid
    ) then
      raise exception 'Custom theme not found' using errcode = 'P0002';
    end if;

    update public.user_preferences p
    set custom_theme_id = p_custom_theme_id
    where p.user_id = v_uid;

  else
    raise exception 'Unsupported theme selection kind';
  end if;

  return public.get_theme_selection();
end;
$$;


-- ============================================================================
-- 7. PRIVILEGES
-- ============================================================================

-- Public wrappers are the only RPC surface exposed to the application role.
revoke execute on all functions in schema private from public, segnalibro_app;

revoke execute on function public.get_library_home(integer) from public;
revoke execute on function public.get_shelf_page(text, timestamptz, uuid, integer) from public;
revoke execute on function public.get_genre_view(text, text, text, integer, integer) from public;
revoke execute on function public.get_book_detail(uuid) from public;
revoke execute on function public.get_explore_pool(text[]) from public;
revoke execute on function public.get_reading_calendar(integer) from public;
revoke execute on function public.get_year_stats(integer) from public;
revoke execute on function public.get_stats_dashboard(integer) from public;
revoke execute on function public.get_bingo_board(integer) from public;

revoke execute on function public.queue_add(uuid, boolean) from public;
revoke execute on function public.queue_remove(uuid) from public;
revoke execute on function public.queue_move(uuid, integer) from public;

revoke execute on function public.start_reading(uuid, timestamptz, integer) from public;
revoke execute on function public.pause_reading(uuid) from public;
revoke execute on function public.resume_reading(uuid) from public;
revoke execute on function public.record_progress(uuid, uuid, integer, timestamptz, date) from public;
revoke execute on function public.correct_progress(uuid, uuid, integer, timestamptz, date) from public;
revoke execute on function public.finish_reading(uuid, uuid, integer, timestamptz, date) from public;
revoke execute on function public.mark_dnf(uuid, uuid, integer, timestamptz, date) from public;
revoke execute on function public.add_completed_reading(uuid, timestamptz, timestamptz, integer, integer) from public;
revoke execute on function public.change_book_genre(uuid, text) from public;
revoke execute on function public.save_review(uuid, smallint, text[], jsonb, smallint[]) from public;

revoke execute on function public.assign_bingo_book(uuid, uuid) from public;
revoke execute on function public.get_theme_selection() from public;
revoke execute on function public.set_theme_selection(text, text, uuid) from public;


grant execute on function public.get_library_home(integer) to segnalibro_app;
grant execute on function public.get_shelf_page(text, timestamptz, uuid, integer) to segnalibro_app;
grant execute on function public.get_genre_view(text, text, text, integer, integer) to segnalibro_app;
grant execute on function public.get_book_detail(uuid) to segnalibro_app;
grant execute on function public.get_explore_pool(text[]) to segnalibro_app;
grant execute on function public.get_reading_calendar(integer) to segnalibro_app;
grant execute on function public.get_year_stats(integer) to segnalibro_app;
grant execute on function public.get_stats_dashboard(integer) to segnalibro_app;
grant execute on function public.get_bingo_board(integer) to segnalibro_app;

grant execute on function public.queue_add(uuid, boolean) to segnalibro_app;
grant execute on function public.queue_remove(uuid) to segnalibro_app;
grant execute on function public.queue_move(uuid, integer) to segnalibro_app;

grant execute on function public.start_reading(uuid, timestamptz, integer) to segnalibro_app;
grant execute on function public.pause_reading(uuid) to segnalibro_app;
grant execute on function public.resume_reading(uuid) to segnalibro_app;
grant execute on function public.record_progress(uuid, uuid, integer, timestamptz, date) to segnalibro_app;
grant execute on function public.correct_progress(uuid, uuid, integer, timestamptz, date) to segnalibro_app;
grant execute on function public.finish_reading(uuid, uuid, integer, timestamptz, date) to segnalibro_app;
grant execute on function public.mark_dnf(uuid, uuid, integer, timestamptz, date) to segnalibro_app;
grant execute on function public.add_completed_reading(uuid, timestamptz, timestamptz, integer, integer) to segnalibro_app;
grant execute on function public.change_book_genre(uuid, text) to segnalibro_app;
grant execute on function public.save_review(uuid, smallint, text[], jsonb, smallint[]) to segnalibro_app;

grant execute on function public.assign_bingo_book(uuid, uuid) to segnalibro_app;
grant execute on function public.get_theme_selection() to segnalibro_app;
grant execute on function public.set_theme_selection(text, text, uuid) to segnalibro_app;

commit;
