-- Segnalibro
-- Migration 002: read models + transactional RPC/domain layer
-- Target: PostgreSQL / Supabase
-- Assumes the schema from migration 001 described in the project spec.

begin;

-- ============================================================
-- 0. SMALL SCHEMA CORRECTIONS
-- ============================================================
-- A correction event must be able to compensate an accidentally
-- overstated page position. Therefore the delta is signed.

alter table public.reading_progress_events
  drop constraint if exists progress_delta_chk;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reading_progress_events'
      and column_name = 'pages_read_delta'
  ) then
    alter table public.reading_progress_events
      rename column pages_read_delta to page_delta;
  end if;
end $$;

-- DNF is a real terminal progress event, like finish.
alter table public.reading_progress_events
  drop constraint if exists progress_type_chk;

alter table public.reading_progress_events
  add constraint progress_type_chk
  check (event_type in ('progress', 'correction', 'finish', 'dnf'));

-- Stable keyset pagination for shelves.
drop index if exists public.user_books_shelf_idx;
create index if not exists user_books_shelf_idx
  on public.user_books (
    user_id,
    genre_id,
    created_at desc,
    id desc
  );

-- Genre view filters/sorts.
create index if not exists user_books_genre_title_idx
  on public.user_books (user_id, genre_id, lower(title), id);

create index if not exists user_books_genre_author_idx
  on public.user_books (user_id, genre_id, lower(author_display), id);

create index if not exists user_books_genre_rating_idx
  on public.user_books (user_id, genre_id, review_rating desc, id)
  where review_rating is not null;

create index if not exists user_books_genre_finished_idx
  on public.user_books (user_id, genre_id, last_finished_at desc, id)
  where last_finished_at is not null;

-- Once the RPC layer owns progress writes, these old triggers are removed.
drop trigger if exists progress_prepare on public.reading_progress_events;
drop trigger if exists progress_apply on public.reading_progress_events;

-- ============================================================
-- 1. PRIVATE HELPERS
-- ============================================================

create or replace function private.require_uid()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return v_uid;
end;
$$;


create or replace function private.compact_reading_queue(p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      q.user_book_id,
      row_number() over (
        order by q.position, q.added_at, q.user_book_id
      )::integer as new_position
    from public.reading_queue q
    where q.user_id = p_user_id
  )
  update public.reading_queue q
  set position = r.new_position
  from ranked r
  where q.user_id = p_user_id
    and q.user_book_id = r.user_book_id
    and q.position is distinct from r.new_position;
$$;


-- Sole write path for progress events.
-- The caller supplies a UUID generated on the client, which gives offline
-- retries true idempotency. Queueing two identical retries is serialized by
-- an advisory transaction lock derived from that UUID.
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
  v_last_activity_at timestamptz;
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
    e.reading_id,
    e.event_type,
    e.page,
    e.page_delta,
    e.local_date,
    e.occurred_at
  into v_existing
  from public.reading_progress_events e
  where e.id = p_event_id
    and e.user_id = v_uid;

  if found then
    if v_existing.reading_id <> p_reading_id then
      raise exception 'event_id already belongs to another reading';
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
    raise exception 'Reading is already closed';
  end if;

  if p_event_type = 'progress' and v_reading.status <> 'active' then
    raise exception 'A progress update requires an active reading';
  end if;

  if p_event_type in ('finish', 'dnf')
     and v_reading.status not in ('active', 'paused') then
    raise exception 'Reading cannot be closed from its current state';
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
  else
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
  where r.id = p_reading_id;

  if v_delta > 0 then
    update public.user_books ub
    set last_activity_at = greatest(
      coalesce(ub.last_activity_at, '-infinity'::timestamptz),
      coalesce(p_occurred_at, now())
    )
    where ub.id = v_reading.user_book_id
      and ub.user_id = v_uid
    returning ub.last_activity_at into v_last_activity_at;
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

-- ============================================================
-- 2. READ MODELS
-- ============================================================

create or replace function public.get_library_home(
  p_shelf_limit integer default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      auth.uid() as uid,
      least(greatest(coalesce(p_shelf_limit, 24), 1), 100) as shelf_limit
  ),

  current_reading as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bookId', ub.id,
          'title', ub.title,
          'author', ub.author_display,
          'genreId', ub.genre_id,
          'format', ub.format,
          'coverUrl', ub.cover_url,
          'coverStoragePath', ub.cover_storage_path,
          'readingId', r.id,
          'readingStatus', r.status,
          'currentPage', r.current_page,
          'pageCount', ub.page_count,
          'percent', case
            when ub.page_count is null or ub.page_count <= 0 then null
            else round(100.0 * r.current_page / ub.page_count, 1)
          end,
          'startedAt', r.started_at
        )
        order by coalesce(ub.last_activity_at, r.started_at) desc, ub.id
      ),
      '[]'::jsonb
    ) as value
    from params p
    join public.readings r
      on r.user_id = p.uid
     and r.ended_at is null
     and r.status in ('active', 'paused')
    join public.user_books ub
      on ub.id = r.user_book_id
     and ub.user_id = p.uid
  ),

  queue as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bookId', ub.id,
          'position', q.position,
          'title', ub.title,
          'author', ub.author_display,
          'genreId', ub.genre_id,
          'format', ub.format,
          'coverUrl', ub.cover_url,
          'coverStoragePath', ub.cover_storage_path,
          'rating', ub.review_rating,
          'lifecycleState', ub.lifecycle_state
        )
        order by q.position
      ),
      '[]'::jsonb
    ) as value
    from params p
    join public.reading_queue q
      on q.user_id = p.uid
    join public.user_books ub
      on ub.id = q.user_book_id
     and ub.user_id = p.uid
  ),

  shelves as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'genreId', g.id,
          'slug', g.slug,
          'name', g.name_it,
          'totalCount', coalesce(c.total_count, 0),
          'hasMore', coalesce(c.total_count, 0) > p.shelf_limit,
          'books', coalesce(b.books, '[]'::jsonb)
        )
        order by g.sort_order
      ),
      '[]'::jsonb
    ) as value
    from params p
    join public.genres g on g.is_active

    left join lateral (
      select count(*)::integer as total_count
      from public.user_books ub
      where ub.user_id = p.uid
        and ub.genre_id = g.id
    ) c on true

    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'bookId', x.id,
          'title', x.title,
          'author', x.author_display,
          'format', x.format,
          'rating', x.review_rating,
          'lifecycleState', x.lifecycle_state,
          'completedReadings', x.completed_readings_count,
          'queuePosition', x.queue_position,
          'createdAt', x.created_at
        )
        order by x.created_at desc, x.id desc
      ) as books
      from (
        select
          ub.id,
          ub.title,
          ub.author_display,
          ub.format,
          ub.review_rating,
          ub.lifecycle_state,
          ub.completed_readings_count,
          ub.created_at,
          q.position as queue_position
        from public.user_books ub
        left join public.reading_queue q
          on q.user_id = ub.user_id
         and q.user_book_id = ub.id
        where ub.user_id = p.uid
          and ub.genre_id = g.id
        order by ub.created_at desc, ub.id desc
        limit p.shelf_limit
      ) x
    ) b on true
  )

  select jsonb_build_object(
    'currentlyReading', cr.value,
    'queue', q.value,
    'shelves', s.value
  )
  from current_reading cr
  cross join queue q
  cross join shelves s;
$$;


create or replace function public.get_shelf_page(
  p_genre_id         smallint,
  p_before_created_at timestamptz default null,
  p_before_id         uuid default null,
  p_limit             integer default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      auth.uid() as uid,
      least(greatest(coalesce(p_limit, 24), 1), 100) as page_limit
  ),
  rows_plus_one as (
    select
      ub.id,
      ub.title,
      ub.author_display,
      ub.format,
      ub.review_rating,
      ub.lifecycle_state,
      ub.completed_readings_count,
      ub.created_at,
      q.position as queue_position,
      row_number() over (
        order by ub.created_at desc, ub.id desc
      ) as rn
    from params p
    join public.user_books ub
      on ub.user_id = p.uid
    left join public.reading_queue q
      on q.user_id = ub.user_id
     and q.user_book_id = ub.id
    where ub.genre_id = p_genre_id
      and (
        p_before_created_at is null
        or ub.created_at < p_before_created_at
        or (
          ub.created_at = p_before_created_at
          and p_before_id is not null
          and ub.id < p_before_id
        )
      )
    order by ub.created_at desc, ub.id desc
    limit (select page_limit + 1 from params)
  ),
  page_rows as (
    select *
    from rows_plus_one
    where rn <= (select page_limit from params)
  ),
  cursor_row as (
    select created_at, id
    from page_rows
    order by created_at asc, id asc
    limit 1
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'bookId', p.id,
            'title', p.title,
            'author', p.author_display,
            'format', p.format,
            'rating', p.review_rating,
            'lifecycleState', p.lifecycle_state,
            'completedReadings', p.completed_readings_count,
            'queuePosition', p.queue_position,
            'createdAt', p.created_at
          )
          order by p.created_at desc, p.id desc
        )
        from page_rows p
      ),
      '[]'::jsonb
    ),
    'hasMore', (
      select count(*) > (select page_limit from params)
      from rows_plus_one
    ),
    'nextCursor', case
      when (
        select count(*) > (select page_limit from params)
        from rows_plus_one
      )
      then (
        select jsonb_build_object(
          'createdAt', c.created_at,
          'id', c.id
        )
        from cursor_row c
      )
      else null
    end
  );
$$;


create or replace function public.get_genre_view(
  p_genre_id smallint,
  p_sort_by  text default 'title',
  p_sort_dir text default 'asc',
  p_limit    integer default 80,
  p_offset   integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      auth.uid() as uid,
      case
        when p_sort_by in ('title', 'author', 'pages', 'rating', 'date')
          then p_sort_by
        else 'title'
      end as sort_by,
      case when lower(p_sort_dir) = 'desc' then 'desc' else 'asc' end as sort_dir,
      least(greatest(coalesce(p_limit, 80), 1), 200) as page_limit,
      greatest(coalesce(p_offset, 0), 0) as page_offset
  ),
  base as (
    select
      ub.*,
      q.position as queue_position,
      case when ub.completed_readings_count > 0 then 0 else 1 end as section_order
    from params p
    join public.user_books ub
      on ub.user_id = p.uid
    left join public.reading_queue q
      on q.user_id = ub.user_id
     and q.user_book_id = ub.id
    where ub.genre_id = p_genre_id
  ),
  ranked as (
    select
      b.*,
      row_number() over (
        order by
          b.section_order asc,

          case when p.sort_by = 'title' and p.sort_dir = 'asc'  then lower(b.title) end asc nulls last,
          case when p.sort_by = 'title' and p.sort_dir = 'desc' then lower(b.title) end desc nulls last,

          case when p.sort_by = 'author' and p.sort_dir = 'asc'  then lower(b.author_display) end asc nulls last,
          case when p.sort_by = 'author' and p.sort_dir = 'desc' then lower(b.author_display) end desc nulls last,

          case when p.sort_by = 'pages' and p.sort_dir = 'asc'  then b.page_count end asc nulls last,
          case when p.sort_by = 'pages' and p.sort_dir = 'desc' then b.page_count end desc nulls last,

          case when p.sort_by = 'rating' and p.sort_dir = 'asc'  then b.review_rating end asc nulls last,
          case when p.sort_by = 'rating' and p.sort_dir = 'desc' then b.review_rating end desc nulls last,

          case when p.sort_by = 'date' and p.sort_dir = 'asc'  then coalesce(b.last_finished_at, b.created_at) end asc nulls last,
          case when p.sort_by = 'date' and p.sort_dir = 'desc' then coalesce(b.last_finished_at, b.created_at) end desc nulls last,

          b.id
      ) as seq
    from base b
    cross join params p
  ),
  ordered as (
    select r.*
    from ranked r
    order by r.seq
    limit (select page_limit from params)
    offset (select page_offset from params)
  )
  select jsonb_build_object(
    'genre', (
      select jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'name', g.name_it
      )
      from public.genres g
      where g.id = p_genre_id
    ),
    'counts', jsonb_build_object(
      'total', (select count(*) from base),
      'read', (select count(*) from base where completed_readings_count > 0),
      'unread', (select count(*) from base where completed_readings_count = 0)
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'bookId', o.id,
            'section', case when o.section_order = 0 then 'read' else 'unread' end,
            'title', o.title,
            'author', o.author_display,
            'pages', o.page_count,
            'rating', o.review_rating,
            'format', o.format,
            'lifecycleState', o.lifecycle_state,
            'completedReadings', o.completed_readings_count,
            'queuePosition', o.queue_position,
            'coverUrl', o.cover_url,
            'coverStoragePath', o.cover_storage_path,
            'lastFinishedAt', o.last_finished_at,
            'createdAt', o.created_at
          )
          order by o.seq
        )
        from ordered o
      ),
      '[]'::jsonb
    )
  );
$$;


create or replace function public.get_book_detail(p_user_book_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  book as (
    select
      ub.*,
      g.slug as genre_slug,
      g.name_it as genre_name,
      q.position as queue_position,
      e.work_id,
      e.publisher,
      e.published_date,
      e.google_books_id,
      e.open_library_edition_id
    from me
    join public.user_books ub
      on ub.user_id = me.uid
     and ub.id = p_user_book_id
    join public.genres g on g.id = ub.genre_id
    left join public.reading_queue q
      on q.user_id = ub.user_id
     and q.user_book_id = ub.id
    left join public.editions e on e.id = ub.edition_id
  )
  select case
    when not exists (select 1 from book) then null
    else jsonb_build_object(
      'book', (
        select jsonb_build_object(
          'id', b.id,
          'title', b.title,
          'author', b.author_display,
          'genreId', b.genre_id,
          'genreSlug', b.genre_slug,
          'genreName', b.genre_name,
          'format', b.format,
          'pages', b.page_count,
          'language', b.language,
          'isbn10', b.isbn_10,
          'isbn13', b.isbn_13,
          'seriesName', b.series_name,
          'seriesNumber', b.series_number,
          'seriesTotal', b.series_total,
          'lifecycleState', b.lifecycle_state,
          'completedReadings', b.completed_readings_count,
          'rating', b.review_rating,
          'queuePosition', b.queue_position,
          'coverUrl', b.cover_url,
          'coverStoragePath', b.cover_storage_path,
          'editionId', b.edition_id,
          'publisher', b.publisher,
          'publishedDate', b.published_date,
          'googleBooksId', b.google_books_id,
          'openLibraryEditionId', b.open_library_edition_id,
          'createdAt', b.created_at,
          'updatedAt', b.updated_at
        )
        from book b
      ),

      'currentReading', (
        select jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'startedAt', r.started_at,
          'currentPage', r.current_page,
          'startPage', r.start_page
        )
        from me
        join public.readings r
          on r.user_id = me.uid
         and r.user_book_id = p_user_book_id
         and r.ended_at is null
        order by r.started_at desc
        limit 1
      ),

      'readings', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'status', r.status,
              'startedAt', r.started_at,
              'endedAt', r.ended_at,
              'startPage', r.start_page,
              'currentPage', r.current_page
            )
            order by r.started_at desc
          )
          from me
          join public.readings r
            on r.user_id = me.uid
           and r.user_book_id = p_user_book_id
        ),
        '[]'::jsonb
      ),

      'review', (
        select jsonb_build_object(
          'id', rv.id,
          'genreId', rv.genre_id,
          'rating', rv.rating,
          'adjectives', rv.adjectives,
          'scores', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'dimensionKey', rs.dimension_key,
                  'label', rd.label_it,
                  'score', rs.score
                )
                order by rd.sort_order
              )
              from public.review_scores rs
              join public.rating_dimensions rd
                on rd.dimension_key = rs.dimension_key
              where rs.user_id = rv.user_id
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
              where ubt.user_id = rv.user_id
                and ubt.user_book_id = rv.user_book_id
            ),
            '[]'::jsonb
          ),
          'createdAt', rv.created_at,
          'updatedAt', rv.updated_at
        )
        from me
        join public.reviews rv
          on rv.user_id = me.uid
         and rv.user_book_id = p_user_book_id
      ),

      'quotes', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', q.id,
              'body', q.body,
              'page', q.page,
              'createdAt', q.created_at
            )
            order by q.created_at desc
          )
          from me
          join public.quotes q
            on q.user_id = me.uid
           and q.user_book_id = p_user_book_id
        ),
        '[]'::jsonb
      )
    )
  end;
$$;


create or replace function public.get_explore_pool(
  p_genre_ids smallint[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bookId', ub.id,
        'title', ub.title,
        'author', ub.author_display,
        'genreId', ub.genre_id,
        'coverUrl', ub.cover_url,
          'coverStoragePath', ub.cover_storage_path,
        'queuePosition', q.position
      )
      order by lower(ub.title), ub.id
    ),
    '[]'::jsonb
  )
  from public.user_books ub
  left join public.reading_queue q
    on q.user_id = ub.user_id
   and q.user_book_id = ub.id
  where ub.user_id = auth.uid()
    and ub.completed_readings_count = 0
    and ub.lifecycle_state = 'unread'
    and (
      p_genre_ids is null
      or cardinality(p_genre_ids) = 0
      or ub.genre_id = any(p_genre_ids)
    );
$$;


create or replace function public.get_reading_calendar(p_year integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with per_genre as (
    select
      e.local_date,
      ub.genre_id,
      sum(e.page_delta)::integer as pages
    from public.reading_progress_events e
    join public.readings r
      on r.id = e.reading_id
     and r.user_id = e.user_id
    join public.user_books ub
      on ub.id = r.user_book_id
     and ub.user_id = e.user_id
    where e.user_id = auth.uid()
      and extract(year from e.local_date)::integer = p_year
    group by e.local_date, ub.genre_id
    having sum(e.page_delta) > 0
  ),
  per_day as (
    select
      pg.local_date,
      sum(pg.pages)::integer as total_pages,
      jsonb_agg(
        jsonb_build_object(
          'genreId', pg.genre_id,
          'slug', g.slug,
          'pages', pg.pages
        )
        order by g.sort_order
      ) as genres
    from per_genre pg
    join public.genres g on g.id = pg.genre_id
    group by pg.local_date
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', d.local_date,
        'pages', d.total_pages,
        'genres', d.genres
      )
      order by d.local_date
    ),
    '[]'::jsonb
  )
  from per_day d;
$$;


create or replace function public.get_year_stats(p_year integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select
      p.id as uid,
      coalesce(p.timezone, 'UTC') as timezone,
      (now() at time zone coalesce(p.timezone, 'UTC'))::date as today
    from public.profiles p
    where p.id = auth.uid()
  ),

  completed as (
    select
      r.id,
      r.user_book_id,
      r.current_page,
      r.start_page,
      r.ended_at,
      (r.ended_at at time zone me.timezone)::date as finished_date,
      ub.genre_id,
      ub.author_display
    from me
    join public.readings r
      on r.user_id = me.uid
     and r.status = 'completed'
     and r.ended_at is not null
    join public.user_books ub
      on ub.id = r.user_book_id
     and ub.user_id = me.uid
    where extract(
      year from (r.ended_at at time zone me.timezone)
    )::integer = p_year
  ),

  tracked_pages as (
    select coalesce(sum(e.page_delta), 0)::integer as pages
    from public.reading_progress_events e
    where e.user_id = auth.uid()
      and extract(year from e.local_date)::integer = p_year
  ),

  historical_fallback_pages as (
    select coalesce(sum(greatest(c.current_page - c.start_page, 0)), 0)::integer as pages
    from completed c
    where not exists (
      select 1
      from public.reading_progress_events e
      where e.user_id = auth.uid()
        and e.reading_id = c.id
    )
  ),

  top_genre as (
    select
      g.id,
      g.slug,
      g.name_it,
      count(*)::integer as reading_count
    from completed c
    join public.genres g on g.id = c.genre_id
    group by g.id, g.slug, g.name_it, g.sort_order
    order by reading_count desc, g.sort_order
    limit 1
  ),

  top_author as (
    select
      c.author_display,
      count(*)::integer as reading_count
    from completed c
    group by c.author_display
    order by reading_count desc, lower(c.author_display)
    limit 1
  ),

  best_month as (
    select
      extract(month from c.finished_date)::integer as month,
      count(*)::integer as reading_count
    from completed c
    group by 1
    order by reading_count desc, month
    limit 1
  ),

  books_this_year as (
    select distinct c.user_book_id
    from completed c
  ),

  top_tags as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'tagId', x.id,
          'slug', x.slug,
          'label', x.label_it,
          'count', x.tag_count
        )
        order by x.tag_count desc, x.sort_order, x.id
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        t.id,
        t.slug,
        t.label_it,
        t.sort_order,
        count(*)::integer as tag_count
      from books_this_year byear
      join public.user_book_tags ubt
        on ubt.user_id = auth.uid()
       and ubt.user_book_id = byear.user_book_id
      join public.tags t on t.id = ubt.tag_id
      group by t.id, t.slug, t.label_it, t.sort_order
      order by tag_count desc, t.sort_order, t.id
      limit 8
    ) x
  ),

  activity_dates as (
    select distinct e.local_date as d
    from public.reading_progress_events e
    where e.user_id = auth.uid()
      and e.page_delta > 0
  ),

  numbered_dates as (
    select
      d,
      d - row_number() over (order by d)::integer as grp
    from activity_dates
  ),

  streaks as (
    select
      min(d) as start_date,
      max(d) as end_date,
      count(*)::integer as days
    from numbered_dates
    group by grp
  ),

  streak_summary as (
    select
      coalesce(max(s.days), 0)::integer as record_days,
      coalesce(
        max(s.days) filter (
          where s.end_date = (select today from me)
             or s.end_date = (select today - 1 from me)
        ),
        0
      )::integer as current_days
    from streaks s
  )

  select jsonb_build_object(
    'year', p_year,
    'completedReadings', (select count(*) from completed),
    'uniqueBooksFinished', (select count(*) from books_this_year),
    'pages', greatest(
      (select pages from tracked_pages)
      + (select pages from historical_fallback_pages),
      0
    ),
    'topGenre', (
      select jsonb_build_object(
        'genreId', tg.id,
        'slug', tg.slug,
        'name', tg.name_it,
        'count', tg.reading_count
      )
      from top_genre tg
    ),
    'topAuthor', (
      select jsonb_build_object(
        'name', ta.author_display,
        'count', ta.reading_count
      )
      from top_author ta
    ),
    'bestMonth', (
      select jsonb_build_object(
        'month', bm.month,
        'count', bm.reading_count
      )
      from best_month bm
    ),
    'topTags', (select value from top_tags),
    'streak', (
      select jsonb_build_object(
        'current', ss.current_days,
        'record', ss.record_days
      )
      from streak_summary ss
    )
  );
$$;



create or replace function public.get_stats_dashboard(p_year integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  bingo as (
    select
      b.id,
      b.year,
      count(c.id)::integer as total_cells,
      count(c.id) filter (where c.completed_at is not null)::integer as completed_cells
    from me
    join public.bingo_boards b
      on b.user_id = me.uid
     and b.year = p_year
    left join public.bingo_cells c
      on c.user_id = b.user_id
     and c.board_id = b.id
    group by b.id, b.year
  ),
  recent_quotes as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'quoteId', x.id,
          'body', x.body,
          'page', x.page,
          'bookId', x.user_book_id,
          'title', x.title,
          'author', x.author_display,
          'genreId', x.genre_id,
          'createdAt', x.created_at
        )
        order by x.created_at desc, x.id
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        q.id, q.body, q.page, q.user_book_id, q.created_at,
        ub.title, ub.author_display, ub.genre_id
      from me
      join public.quotes q on q.user_id = me.uid
      join public.user_books ub
        on ub.id = q.user_book_id
       and ub.user_id = me.uid
      order by q.created_at desc, q.id
      limit 4
    ) x
  ),
  cemetery as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bookId', x.id,
          'title', x.title,
          'author', x.author_display,
          'genreId', x.genre_id,
          'coverUrl', x.cover_url,
          'coverStoragePath', x.cover_storage_path,
          'dnfPage', x.current_page,
          'dnfAt', x.ended_at
        )
        order by x.ended_at desc, x.id
      ),
      '[]'::jsonb
    ) as value
    from (
      select distinct on (ub.id)
        ub.id, ub.title, ub.author_display, ub.genre_id,
        ub.cover_storage_path, ub.cover_url,
        r.current_page, r.ended_at
      from me
      join public.user_books ub
        on ub.user_id = me.uid
       and ub.lifecycle_state = 'dnf'
       and ub.completed_readings_count = 0
      join public.readings r
        on r.user_id = me.uid
       and r.user_book_id = ub.id
       and r.status = 'dnf'
      order by ub.id, r.ended_at desc
    ) x
  )
  select jsonb_build_object(
    'yearStats', public.get_year_stats(p_year),
    'bingo', (
      select jsonb_build_object(
        'boardId', b.id,
        'year', b.year,
        'completed', b.completed_cells,
        'total', b.total_cells
      )
      from bingo b
    ),
    'recentQuotes', (select value from recent_quotes),
    'dnfCemetery', (select value from cemetery)
  );
$$;


create or replace function public.get_bingo_board(p_year integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'boardId', b.id,
    'year', b.year,
    'title', b.title,
    'completed', count(c.id) filter (where c.completed_at is not null),
    'total', count(c.id),
    'cells', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cellId', c.id,
          'position', c.position,
          'challenge', c.challenge,
          'completedAt', c.completed_at,
          'book', case
            when ub.id is null then null
            else jsonb_build_object(
              'bookId', ub.id,
              'title', ub.title,
              'author', ub.author_display,
              'coverUrl', ub.cover_url,
              'coverStoragePath', ub.cover_storage_path
            )
          end
        )
        order by c.position
      ),
      '[]'::jsonb
    )
  )
  from public.bingo_boards b
  left join public.bingo_cells c
    on c.user_id = b.user_id
   and c.board_id = b.id
  left join public.user_books ub
    on ub.user_id = b.user_id
   and ub.id = c.user_book_id
  where b.user_id = auth.uid()
    and b.year = p_year
  group by b.id, b.year, b.title;
$$;


-- ============================================================
-- 3. QUEUE RPCs
-- ============================================================

create or replace function public.queue_add(
  p_user_book_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_uid();
  v_count    integer;
  v_existing integer;
  v_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || v_uid::text, 0)
  );

  if not exists (
    select 1
    from public.user_books ub
    where ub.id = p_user_book_id
      and ub.user_id = v_uid
  ) then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  select q.position
    into v_existing
  from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_user_book_id;

  if found then
    return jsonb_build_object(
      'added', false,
      'alreadyQueued', true,
      'requiresConfirmation', false,
      'count', (select count(*) from public.reading_queue where user_id = v_uid),
      'position', v_existing
    );
  end if;

  select count(*)::integer
    into v_count
  from public.reading_queue q
  where q.user_id = v_uid;

  if v_count >= 3 and not p_force then
    return jsonb_build_object(
      'added', false,
      'alreadyQueued', false,
      'requiresConfirmation', true,
      'count', v_count,
      'position', null
    );
  end if;

  v_position := v_count + 1;

  insert into public.reading_queue (
    user_id,
    user_book_id,
    position
  )
  values (
    v_uid,
    p_user_book_id,
    v_position
  );

  return jsonb_build_object(
    'added', true,
    'alreadyQueued', false,
    'requiresConfirmation', false,
    'count', v_count + 1,
    'position', v_position
  );
end;
$$;


create or replace function public.queue_remove(p_user_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_deleted integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || v_uid::text, 0)
  );

  delete from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_user_book_id;

  get diagnostics v_deleted = row_count;

  perform private.compact_reading_queue(v_uid);

  return jsonb_build_object(
    'removed', v_deleted > 0,
    'count', (select count(*) from public.reading_queue where user_id = v_uid)
  );
end;
$$;


create or replace function public.queue_move(
  p_user_book_id uuid,
  p_new_position integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := private.require_uid();
  v_old_position integer;
  v_count        integer;
  v_target       integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || v_uid::text, 0)
  );

  select q.position
    into v_old_position
  from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_user_book_id
  for update;

  if not found then
    raise exception 'Book is not in reading queue' using errcode = 'P0002';
  end if;

  select count(*)::integer
    into v_count
  from public.reading_queue q
  where q.user_id = v_uid;

  v_target := least(greatest(coalesce(p_new_position, v_old_position), 1), v_count);

  if v_target = v_old_position then
    return jsonb_build_object('position', v_old_position, 'count', v_count);
  end if;

  if v_target < v_old_position then
    update public.reading_queue q
    set position = position + 1
    where q.user_id = v_uid
      and q.position >= v_target
      and q.position < v_old_position;
  else
    update public.reading_queue q
    set position = position - 1
    where q.user_id = v_uid
      and q.position > v_old_position
      and q.position <= v_target;
  end if;

  update public.reading_queue q
  set position = v_target
  where q.user_id = v_uid
    and q.user_book_id = p_user_book_id;

  return jsonb_build_object('position', v_target, 'count', v_count);
end;
$$;

-- ============================================================
-- 4. READING RPCs
-- ============================================================

create or replace function public.start_reading(
  p_user_book_id uuid,
  p_start_page integer default 0,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := private.require_uid();
  v_reading_id uuid;
begin
  if coalesce(p_start_page, 0) < 0 then
    raise exception 'start_page must be >= 0';
  end if;

  perform 1
  from public.user_books ub
  where ub.id = p_user_book_id
    and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.readings r
    where r.user_id = v_uid
      and r.user_book_id = p_user_book_id
      and r.ended_at is null
  ) then
    raise exception 'Book already has an open reading';
  end if;

  insert into public.readings (
    user_id,
    user_book_id,
    status,
    started_at,
    start_page,
    current_page
  )
  values (
    v_uid,
    p_user_book_id,
    'active',
    coalesce(p_started_at, now()),
    coalesce(p_start_page, 0),
    coalesce(p_start_page, 0)
  )
  returning id into v_reading_id;

  -- A book that is now being read is no longer "next".
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || v_uid::text, 0)
  );

  delete from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_user_book_id;

  perform private.compact_reading_queue(v_uid);

  return jsonb_build_object(
    'readingId', v_reading_id,
    'bookId', p_user_book_id,
    'status', 'active',
    'currentPage', coalesce(p_start_page, 0),
    'startedAt', coalesce(p_started_at, now())
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
  v_row public.readings%rowtype;
begin
  update public.readings r
  set status = 'paused'
  where r.id = p_reading_id
    and r.user_id = v_uid
    and r.ended_at is null
    and r.status = 'active'
  returning r.* into v_row;

  if not found then
    raise exception 'Active reading not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'readingId', v_row.id,
    'status', v_row.status,
    'currentPage', v_row.current_page
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
  v_row public.readings%rowtype;
begin
  update public.readings r
  set status = 'active'
  where r.id = p_reading_id
    and r.user_id = v_uid
    and r.ended_at is null
    and r.status = 'paused'
  returning r.* into v_row;

  if not found then
    raise exception 'Paused reading not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'readingId', v_row.id,
    'status', v_row.status,
    'currentPage', v_row.current_page
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
language sql
security definer
set search_path = ''
as $$
  select private.apply_progress_event(
    p_event_id,
    p_reading_id,
    'progress',
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );
$$;


create or replace function public.correct_progress(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_progress_event(
    p_event_id,
    p_reading_id,
    'correction',
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );
$$;


create or replace function public.finish_reading(
  p_event_id uuid,
  p_reading_id uuid,
  p_final_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_progress_event(
    p_event_id,
    p_reading_id,
    'finish',
    p_final_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );
$$;


create or replace function public.mark_dnf(
  p_event_id uuid,
  p_reading_id uuid,
  p_page integer,
  p_occurred_at timestamptz default now(),
  p_local_date date default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_progress_event(
    p_event_id,
    p_reading_id,
    'dnf',
    p_page,
    coalesce(p_occurred_at, now()),
    p_local_date
  );
$$;


-- Used both for "Segna come letto" and for importing historical readings.
-- It deliberately creates no daily activity events: calendar/streak only come
-- from actual progress updates, while yearly page totals have a fallback.
create or replace function public.add_completed_reading(
  p_user_book_id uuid,
  p_started_at timestamptz default null,
  p_finished_at timestamptz default now(),
  p_final_page integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := private.require_uid();
  v_book       record;
  v_reading_id uuid;
  v_finished   timestamptz := coalesce(p_finished_at, now());
  v_started    timestamptz;
  v_page       integer;
begin
  select ub.id, ub.page_count
    into v_book
  from public.user_books ub
  where ub.id = p_user_book_id
    and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  v_started := coalesce(p_started_at, v_finished);
  if v_started > v_finished then
    raise exception 'started_at cannot be after finished_at';
  end if;

  v_page := coalesce(p_final_page, v_book.page_count, 0);
  if v_page < 0 then
    raise exception 'final_page must be >= 0';
  end if;

  insert into public.readings (
    user_id,
    user_book_id,
    status,
    started_at,
    ended_at,
    start_page,
    current_page
  )
  values (
    v_uid,
    p_user_book_id,
    'completed',
    v_started,
    v_finished,
    0,
    v_page
  )
  returning id into v_reading_id;

  return jsonb_build_object(
    'readingId', v_reading_id,
    'bookId', p_user_book_id,
    'status', 'completed',
    'startedAt', v_started,
    'finishedAt', v_finished,
    'finalPage', v_page
  );
end;
$$;

-- ============================================================
-- 5. BOOK / GENRE DOMAIN RPC
-- ============================================================

create or replace function public.change_book_genre(
  p_user_book_id uuid,
  p_genre_id smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := private.require_uid();
  v_old_genre    smallint;
  v_review_id    uuid;
  v_scores_reset boolean := false;
begin
  if not exists (
    select 1 from public.genres g
    where g.id = p_genre_id
      and g.is_active
  ) then
    raise exception 'Genre not found' using errcode = 'P0002';
  end if;

  select ub.genre_id
    into v_old_genre
  from public.user_books ub
  where ub.id = p_user_book_id
    and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if v_old_genre = p_genre_id then
    return jsonb_build_object(
      'bookId', p_user_book_id,
      'genreId', p_genre_id,
      'reviewScoresReset', false
    );
  end if;

  update public.user_books ub
  set genre_id = p_genre_id
  where ub.id = p_user_book_id
    and ub.user_id = v_uid;

  select rv.id
    into v_review_id
  from public.reviews rv
  where rv.user_id = v_uid
    and rv.user_book_id = p_user_book_id
  for update;

  if found then
    delete from public.review_scores rs
    where rs.user_id = v_uid
      and rs.review_id = v_review_id;

    update public.reviews rv
    set genre_id = p_genre_id
    where rv.id = v_review_id
      and rv.user_id = v_uid;

    v_scores_reset := true;
  end if;

  return jsonb_build_object(
    'bookId', p_user_book_id,
    'genreId', p_genre_id,
    'reviewScoresReset', v_scores_reset
  );
end;
$$;

-- ============================================================
-- 6. REVIEW RPC
-- ============================================================

create or replace function public.save_review(
  p_user_book_id uuid,
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
  v_uid         uuid := private.require_uid();
  v_genre_id    smallint;
  v_completed   smallint;
  v_review_id   uuid;
  v_adjectives  text[];
  v_score       record;
  v_tag_count   integer;
begin
  if p_rating not between 1 and 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select ub.genre_id, ub.completed_readings_count
    into v_genre_id, v_completed
  from public.user_books ub
  where ub.id = p_user_book_id
    and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if v_completed < 1 then
    raise exception 'Review requires at least one completed reading';
  end if;

  select array_agg(x.adjective order by x.ord)
    into v_adjectives
  from (
    select btrim(u.adjective) as adjective, u.ord
    from unnest(p_adjectives) with ordinality as u(adjective, ord)
  ) x;

  if cardinality(v_adjectives) <> 3
     or exists (
       select 1
       from unnest(v_adjectives) a
       where a is null or a = ''
     )
     or (
       select count(distinct lower(a))
       from unnest(v_adjectives) a
     ) <> 3
  then
    raise exception 'Exactly 3 distinct non-empty adjectives are required';
  end if;

  insert into public.reviews (
    user_id,
    user_book_id,
    genre_id,
    rating,
    adjectives
  )
  values (
    v_uid,
    p_user_book_id,
    v_genre_id,
    p_rating,
    v_adjectives
  )
  on conflict (user_id, user_book_id)
  do update set
    genre_id = excluded.genre_id,
    rating = excluded.rating,
    adjectives = excluded.adjectives
  returning id into v_review_id;

  delete from public.review_scores rs
  where rs.user_id = v_uid
    and rs.review_id = v_review_id;

  if p_scores is null then
    p_scores := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_scores) <> 'array' then
    raise exception 'scores must be a JSON array';
  end if;

  for v_score in
    select *
    from jsonb_to_recordset(p_scores)
      as x(dimension_key text, score integer)
  loop
    if v_score.score not between 1 and 5 then
      raise exception 'Every dimension score must be between 1 and 5';
    end if;

    if not exists (
      select 1
      from public.rating_dimensions rd
      where rd.dimension_key = v_score.dimension_key
        and rd.genre_id = v_genre_id
        and rd.is_active
    ) then
      raise exception 'Invalid rating dimension: %', v_score.dimension_key;
    end if;

    insert into public.review_scores (
      user_id,
      review_id,
      dimension_key,
      score
    )
    values (
      v_uid,
      v_review_id,
      v_score.dimension_key,
      v_score.score
    );
  end loop;

  delete from public.user_book_tags ubt
  where ubt.user_id = v_uid
    and ubt.user_book_id = p_user_book_id;

  if cardinality(coalesce(p_tag_ids, '{}'::smallint[])) > 0 then
    select count(*)::integer
      into v_tag_count
    from public.tags t
    where t.id = any(p_tag_ids)
      and t.is_active;

    if v_tag_count <> (
      select count(distinct x)
      from unnest(p_tag_ids) x
    ) then
      raise exception 'One or more tag IDs are invalid';
    end if;

    insert into public.user_book_tags (
      user_id,
      user_book_id,
      tag_id
    )
    select
      v_uid,
      p_user_book_id,
      x
    from (
      select distinct unnest(p_tag_ids) as x
    ) d;
  end if;

  return jsonb_build_object(
    'reviewId', v_review_id,
    'bookId', p_user_book_id,
    'rating', p_rating,
    'adjectives', to_jsonb(v_adjectives),
    'genreId', v_genre_id
  );
end;
$$;

-- ============================================================
-- 7. WRITE-PATH HARDENING
-- ============================================================
-- Domain tables with invariants are written through the RPCs above.
-- Simple rows such as quotes / bingo can continue using direct RLS CRUD.

revoke insert, update, delete
on public.reading_queue
from authenticated;

revoke insert, update, delete
on public.readings
from authenticated;

revoke insert, update, delete
on public.reading_progress_events
from authenticated;

revoke insert, update, delete
on public.reviews
from authenticated;

revoke insert, update, delete
on public.review_scores
from authenticated;

revoke insert, update, delete
on public.user_book_tags
from authenticated;

-- Prevent clients from modifying derived projection columns directly.
revoke update on public.user_books from authenticated;
grant update (
  genre_id,
  title,
  author_display,
  page_count,
  language,
  isbn_10,
  isbn_13,
  format,
  series_name,
  series_number,
  series_total,
  cover_url,
  cover_storage_path
)
on table public.user_books
to authenticated;

-- ============================================================
-- 8. RPC EXECUTE PRIVILEGES
-- ============================================================
-- PostgreSQL grants function EXECUTE to PUBLIC by default, so explicitly
-- remove it and expose only the intended RPCs to authenticated users.

revoke execute on function public.get_library_home(integer) from public, anon;
revoke execute on function public.get_shelf_page(smallint, timestamptz, uuid, integer) from public, anon;
revoke execute on function public.get_genre_view(smallint, text, text, integer, integer) from public, anon;
revoke execute on function public.get_book_detail(uuid) from public, anon;
revoke execute on function public.get_explore_pool(smallint[]) from public, anon;
revoke execute on function public.get_reading_calendar(integer) from public, anon;
revoke execute on function public.get_year_stats(integer) from public, anon;
revoke execute on function public.get_stats_dashboard(integer) from public, anon;
revoke execute on function public.get_bingo_board(integer) from public, anon;

revoke execute on function public.queue_add(uuid, boolean) from public, anon;
revoke execute on function public.queue_remove(uuid) from public, anon;
revoke execute on function public.queue_move(uuid, integer) from public, anon;

revoke execute on function public.start_reading(uuid, integer, timestamptz) from public, anon;
revoke execute on function public.pause_reading(uuid) from public, anon;
revoke execute on function public.resume_reading(uuid) from public, anon;
revoke execute on function public.record_progress(uuid, uuid, integer, timestamptz, date) from public, anon;
revoke execute on function public.correct_progress(uuid, uuid, integer, timestamptz, date) from public, anon;
revoke execute on function public.finish_reading(uuid, uuid, integer, timestamptz, date) from public, anon;
revoke execute on function public.mark_dnf(uuid, uuid, integer, timestamptz, date) from public, anon;
revoke execute on function public.add_completed_reading(uuid, timestamptz, timestamptz, integer) from public, anon;
revoke execute on function public.change_book_genre(uuid, smallint) from public, anon;
revoke execute on function public.save_review(uuid, smallint, text[], jsonb, smallint[]) from public, anon;

grant execute on function public.get_library_home(integer) to authenticated;
grant execute on function public.get_shelf_page(smallint, timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_genre_view(smallint, text, text, integer, integer) to authenticated;
grant execute on function public.get_book_detail(uuid) to authenticated;
grant execute on function public.get_explore_pool(smallint[]) to authenticated;
grant execute on function public.get_reading_calendar(integer) to authenticated;
grant execute on function public.get_year_stats(integer) to authenticated;
grant execute on function public.get_stats_dashboard(integer) to authenticated;
grant execute on function public.get_bingo_board(integer) to authenticated;

grant execute on function public.queue_add(uuid, boolean) to authenticated;
grant execute on function public.queue_remove(uuid) to authenticated;
grant execute on function public.queue_move(uuid, integer) to authenticated;

grant execute on function public.start_reading(uuid, integer, timestamptz) to authenticated;
grant execute on function public.pause_reading(uuid) to authenticated;
grant execute on function public.resume_reading(uuid) to authenticated;
grant execute on function public.record_progress(uuid, uuid, integer, timestamptz, date) to authenticated;
grant execute on function public.correct_progress(uuid, uuid, integer, timestamptz, date) to authenticated;
grant execute on function public.finish_reading(uuid, uuid, integer, timestamptz, date) to authenticated;
grant execute on function public.mark_dnf(uuid, uuid, integer, timestamptz, date) to authenticated;
grant execute on function public.add_completed_reading(uuid, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.change_book_genre(uuid, smallint) to authenticated;
grant execute on function public.save_review(uuid, smallint, text[], jsonb, smallint[]) to authenticated;

commit;
