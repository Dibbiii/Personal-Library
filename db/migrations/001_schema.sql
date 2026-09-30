-- Segnalibro
-- Migration 001: core schema
-- Target: PostgreSQL 17 (plain Postgres, no external auth/API layer)
--
-- This migration is the foundation expected by migrations 002 and 003.
-- It intentionally keeps user-owned data separate from the shared catalog.
--
-- Differences from the original package (see docs/DATABASE.md):
--   * auth.users / auth.uid()  ->  app.users / app.current_user_id()
--   * anon / authenticated / service_role  ->  the single runtime role
--     `segnalibro_app` (NOBYPASSRLS); DDL/seed run as the admin role.
--   * sessions live in app.sessions.

begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Runtime role
--
-- The application connects as `segnalibro_app`. It can never bypass RLS and
-- owns nothing. The password below is a DEVELOPMENT default: in production set
-- a real one with  ALTER ROLE segnalibro_app PASSWORD '...'.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'segnalibro_app') then
    create role segnalibro_app
      login nosuperuser nobypassrls nocreatedb nocreaterole noreplication
      password 'segnalibro_app';
  end if;
end;
$$;

revoke all on schema private from public;
revoke all on schema app from public;
revoke all on schema extensions from public;

grant usage on schema public to segnalibro_app;
grant usage on schema app to segnalibro_app;

-- ---------------------------------------------------------------------------
-- Request identity
--
-- The server opens a transaction and runs
--   select set_config('app.user_id', '<uuid>', true)
-- (transaction-local). Every RLS policy and RPC reads the caller from here.
-- NULL / empty means "anonymous": no row of a user-owned table is visible.
-- ---------------------------------------------------------------------------

create or replace function app.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

revoke all on function app.current_user_id() from public;
grant execute on function app.current_user_id() to segnalibro_app;

-- ---------------------------------------------------------------------------
-- Accounts and sessions (replaces the external auth service)
--
-- Only SECURITY DEFINER functions from migration 007 touch these tables;
-- segnalibro_app has no direct privileges on them.
-- ---------------------------------------------------------------------------

create table app.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  display_name   text,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_login_at  timestamptz,

  constraint users_email_norm_chk
    check (email = lower(btrim(email))),
  constraint users_email_shape_chk
    check (char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  constraint users_display_name_chk
    check (display_name is null or char_length(display_name) <= 80),
  constraint users_password_hash_chk
    check (btrim(password_hash) <> '')
);

create unique index users_email_uidx on app.users (email);

create table app.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app.users(id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),

  constraint sessions_token_hash_chk check (token_hash ~ '^[0-9a-f]{64}$')
);

create index sessions_user_idx on app.sessions (user_id);
create index sessions_expires_idx on app.sessions (expires_at);

revoke all on all tables in schema app from public;

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data: genres
-- Colors are NOT stored here. They are theme tokens in application source.
-- ---------------------------------------------------------------------------

create table public.genres (
  id          smallint primary key,
  slug        text not null unique,
  name_it     text not null,
  sort_order  smallint not null unique,
  is_active   boolean not null default true,

  constraint genres_slug_chk check (slug ~ '^[a-z0-9-]+$'),
  constraint genres_sort_order_chk check (sort_order > 0)
);

insert into public.genres (id, slug, name_it, sort_order)
values
  (1, 'classics', 'Classici', 1),
  (2, 'mythology-epic-retelling', 'Mitologia, Epica e Retelling', 2),
  (3, 'dystopia-scifi', 'Distopia e Fantascienza', 3),
  (4, 'thriller-mystery', 'Thriller, Gialli e Mistero', 4),
  (5, 'fantasy-magical-gothic', 'Fantasy, Realismo Magico e Gotico', 5),
  (6, 'romance-ya-na', 'Romance, Young Adult e New Adult', 6),
  (7, 'contemporary-historical', 'Narrativa Contemporanea e Storica', 7)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Shared catalog: Work -> Edition -> UserBook
-- ---------------------------------------------------------------------------

create table public.works (
  id                    bigint generated always as identity primary key,
  title                 text not null,
  original_title        text,
  first_published_year  smallint,
  open_library_work_id  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint works_title_chk check (btrim(title) <> ''),
  constraint works_year_chk check (
    first_published_year is null
    or first_published_year between 1000 and 3000
  )
);

create unique index works_open_library_uidx
  on public.works (open_library_work_id)
  where open_library_work_id is not null;

create index works_title_trgm_idx
  on public.works using gin (title extensions.gin_trgm_ops);

create table public.authors (
  id                     bigint generated always as identity primary key,
  name                   text not null,
  open_library_author_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint authors_name_chk check (btrim(name) <> '')
);

create unique index authors_open_library_uidx
  on public.authors (open_library_author_id)
  where open_library_author_id is not null;

create index authors_name_trgm_idx
  on public.authors using gin (name extensions.gin_trgm_ops);

create table public.work_authors (
  work_id      bigint not null references public.works(id) on delete cascade,
  author_id    bigint not null references public.authors(id) on delete restrict,
  position     smallint not null default 1,

  primary key (work_id, author_id),
  constraint work_authors_position_unique unique (work_id, position),
  constraint work_authors_position_chk check (position > 0)
);

create index work_authors_author_idx
  on public.work_authors (author_id);

create table public.editions (
  id                       bigint generated always as identity primary key,
  work_id                  bigint not null references public.works(id) on delete cascade,

  isbn_10                  text,
  isbn_13                  text,
  language                 text,
  publisher                text,
  published_date           date,
  published_year           smallint,
  page_count               integer,

  google_books_id          text,
  open_library_edition_id  text,

  cover_provider           text,
  cover_ref                text,
  cover_url                text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint editions_isbn10_chk check (
    isbn_10 is null or isbn_10 ~ '^[0-9]{9}[0-9X]$'
  ),
  constraint editions_isbn13_chk check (
    isbn_13 is null or isbn_13 ~ '^[0-9]{13}$'
  ),
  constraint editions_page_count_chk check (
    page_count is null or page_count > 0
  ),
  constraint editions_published_year_chk check (
    published_year is null or published_year between 1000 and 3000
  ),
  constraint editions_language_chk check (
    language is null or char_length(language) <= 16
  )
);

create index editions_work_idx on public.editions (work_id);

create unique index editions_isbn13_uidx
  on public.editions (isbn_13) where isbn_13 is not null;

create unique index editions_isbn10_uidx
  on public.editions (isbn_10) where isbn_10 is not null;

create unique index editions_google_books_uidx
  on public.editions (google_books_id) where google_books_id is not null;

create unique index editions_open_library_uidx
  on public.editions (open_library_edition_id) where open_library_edition_id is not null;

-- ---------------------------------------------------------------------------
-- User / preferences / custom themes
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references app.users(id) on delete cascade,
  display_name  text,
  locale        text not null default 'it-IT',
  timezone      text not null default 'Europe/Rome',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_locale_chk check (char_length(locale) between 2 and 35),
  constraint profiles_timezone_chk check (char_length(timezone) between 1 and 100)
);

create table public.custom_themes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references app.users(id) on delete cascade,
  name            text not null,
  schema_version  smallint not null default 1,
  tokens          jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, id),

  constraint custom_themes_name_chk
    check (char_length(btrim(name)) between 1 and 80),
  constraint custom_themes_tokens_object_chk
    check (jsonb_typeof(tokens) = 'object'),
  constraint custom_themes_tokens_size_chk
    check (octet_length(tokens::text) <= 65536),
  constraint custom_themes_schema_version_chk
    check (schema_version > 0)
);

create table public.user_preferences (
  user_id           uuid primary key references app.users(id) on delete cascade,

  theme_key         text not null default 'segnalibro',
  custom_theme_id   uuid,

  shelf_mode        text not null default 'hybrid',
  motion_preference text not null default 'system',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint user_preferences_custom_theme_fk
    foreign key (user_id, custom_theme_id)
    references public.custom_themes(user_id, id)
    on delete restrict,

  constraint user_preferences_theme_key_chk check (btrim(theme_key) <> ''),
  constraint user_preferences_shelf_mode_chk
    check (shelf_mode in ('hybrid', 'spines', 'covers')),
  constraint user_preferences_motion_chk
    check (motion_preference in ('system', 'reduce', 'full'))
);

create index user_preferences_custom_theme_idx
  on public.user_preferences (custom_theme_id)
  where custom_theme_id is not null;

-- ---------------------------------------------------------------------------
-- User library
--
-- Snapshot fields deliberately preserve what the user chose at import time.
-- edition_id may be NULL for fully manual books.
-- ---------------------------------------------------------------------------

create table public.user_books (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references app.users(id) on delete cascade,

  edition_id     bigint references public.editions(id) on delete set null,
  genre_id       smallint not null references public.genres(id) on delete restrict,

  title          text not null,
  author_display text not null,

  page_count     integer,
  language       text,

  isbn_10        text,
  isbn_13        text,

  format         text not null,

  series_name    text,
  series_number  numeric(6,2),
  series_total   smallint,

  cover_url          text,
  cover_storage_path text,

  source         text not null default 'manual',

  -- Derived/cached projections maintained by DB/domain operations.
  lifecycle_state          text not null default 'unread',
  completed_readings_count smallint not null default 0,
  review_rating            smallint,
  last_finished_at         timestamptz,
  last_activity_at         timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (user_id, id),

  constraint user_books_title_chk check (btrim(title) <> ''),
  constraint user_books_author_chk check (btrim(author_display) <> ''),
  constraint user_books_page_count_chk check (
    page_count is null or page_count > 0
  ),
  constraint user_books_format_chk check (
    format in ('physical', 'digital')
  ),
  constraint user_books_source_chk check (
    source in ('manual', 'isbn', 'search', 'import')
  ),
  constraint user_books_series_number_chk check (
    series_number is null or series_number > 0
  ),
  constraint user_books_series_total_chk check (
    series_total is null or series_total > 0
  ),
  constraint user_books_series_range_chk check (
    series_total is null
    or series_number is null
    or series_number <= series_total
  ),
  constraint user_books_state_chk check (
    lifecycle_state in ('unread', 'reading', 'paused', 'finished', 'dnf')
  ),
  constraint user_books_completed_count_chk check (
    completed_readings_count >= 0
  ),
  constraint user_books_review_rating_chk check (
    review_rating is null or review_rating between 1 and 5
  )
);

create index user_books_shelf_idx
  on public.user_books (user_id, genre_id, created_at desc, id desc);

create index user_books_current_reading_idx
  on public.user_books (user_id, last_activity_at desc)
  where lifecycle_state in ('reading', 'paused');

create index user_books_edition_idx
  on public.user_books (edition_id)
  where edition_id is not null;

create index user_books_title_trgm_idx
  on public.user_books using gin (title extensions.gin_trgm_ops);

create index user_books_author_trgm_idx
  on public.user_books using gin (author_display extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Reading queue ("I prossimi")
-- ---------------------------------------------------------------------------

create table public.reading_queue (
  user_id       uuid not null,
  user_book_id  uuid not null,
  position      integer not null,
  added_at      timestamptz not null default now(),

  primary key (user_id, user_book_id),

  constraint reading_queue_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete cascade,

  constraint reading_queue_position_chk check (position > 0),

  constraint reading_queue_position_unique
    unique (user_id, position)
    deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- Reading sessions
-- ---------------------------------------------------------------------------

create table public.readings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  user_book_id  uuid not null,

  status        text not null default 'active',

  started_at    timestamptz not null default now(),
  ended_at      timestamptz,

  start_page    integer not null default 0,
  current_page  integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, id),

  constraint readings_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete cascade,

  constraint readings_status_chk check (
    status in ('active', 'paused', 'completed', 'dnf')
  ),
  constraint readings_pages_chk check (
    start_page >= 0 and current_page >= 0
  ),
  constraint readings_dates_chk check (
    ended_at is null or ended_at >= started_at
  ),
  constraint readings_state_dates_chk check (
    (status in ('active', 'paused') and ended_at is null)
    or
    (status in ('completed', 'dnf') and ended_at is not null)
  )
);

create unique index readings_one_open_per_book_idx
  on public.readings (user_id, user_book_id)
  where ended_at is null;

create index readings_book_history_idx
  on public.readings (user_id, user_book_id, started_at desc);

create index readings_completed_idx
  on public.readings (user_id, ended_at desc)
  where status = 'completed';

-- ---------------------------------------------------------------------------
-- Immutable reading progress log
-- page_delta is signed. Corrections may compensate previous over-counting.
-- ---------------------------------------------------------------------------

create table public.reading_progress_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  reading_id  uuid not null,

  event_type  text not null,
  page        integer not null,
  page_delta  integer not null default 0,

  local_date  date not null,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  constraint progress_reading_fk
    foreign key (user_id, reading_id)
    references public.readings(user_id, id)
    on delete cascade,

  constraint progress_type_chk check (
    event_type in ('progress', 'correction', 'finish', 'dnf')
  ),
  constraint progress_page_chk check (page >= 0)
);

create index progress_user_date_idx
  on public.reading_progress_events (
    user_id,
    local_date desc,
    occurred_at desc
  );

create index progress_reading_idx
  on public.reading_progress_events (
    reading_id,
    occurred_at,
    id
  );

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  user_book_id  uuid not null,

  -- Snapshot of genre at review creation/update.
  genre_id      smallint not null references public.genres(id) on delete restrict,

  rating        smallint not null,
  adjectives    text[] not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, id),
  unique (user_id, user_book_id),

  constraint reviews_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete cascade,

  constraint reviews_rating_chk check (rating between 1 and 5),
  constraint reviews_adjectives_chk check (cardinality(adjectives) = 3)
);

create table public.rating_dimensions (
  dimension_key  text primary key,
  genre_id       smallint not null references public.genres(id) on delete cascade,
  label_it       text not null,
  sort_order     smallint not null,
  version        smallint not null default 1,
  is_active      boolean not null default true,

  constraint rating_dimensions_key_chk
    check (dimension_key ~ '^[a-z0-9._-]+$'),
  constraint rating_dimensions_sort_chk check (sort_order > 0),
  constraint rating_dimensions_version_chk check (version > 0)
);

create index rating_dimensions_genre_idx
  on public.rating_dimensions (genre_id, sort_order);

create table public.review_scores (
  user_id        uuid not null,
  review_id      uuid not null,
  dimension_key  text not null
                 references public.rating_dimensions(dimension_key)
                 on delete restrict,
  score          smallint not null,

  primary key (user_id, review_id, dimension_key),

  constraint review_scores_review_fk
    foreign key (user_id, review_id)
    references public.reviews(user_id, id)
    on delete cascade,

  constraint review_scores_score_chk check (score between 1 and 5)
);

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id          smallint generated always as identity primary key,
  slug        text not null unique,
  label_it    text not null,
  sort_order  smallint not null,
  is_active   boolean not null default true,
  constraint tags_slug_chk check (slug ~ '^[a-z0-9-]+$')
);

create table public.user_book_tags (
  user_id       uuid not null,
  user_book_id  uuid not null,
  tag_id        smallint not null references public.tags(id) on delete restrict,

  primary key (user_id, user_book_id, tag_id),

  constraint user_book_tags_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete cascade
);

create index user_book_tags_stats_idx
  on public.user_book_tags (user_id, tag_id);

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  user_book_id  uuid not null,

  body          text not null,
  page          integer,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint quotes_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete cascade,

  constraint quotes_body_chk check (
    btrim(body) <> '' and char_length(body) <= 5000
  ),
  constraint quotes_page_chk check (
    page is null or page > 0
  )
);

create index quotes_user_created_idx
  on public.quotes (user_id, created_at desc);

create index quotes_book_idx
  on public.quotes (user_id, user_book_id, created_at);

-- ---------------------------------------------------------------------------
-- Bookish Bingo
-- ---------------------------------------------------------------------------

create table public.bingo_boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app.users(id) on delete cascade,
  year        smallint not null,
  title       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, id),
  unique (user_id, year),

  constraint bingo_board_year_chk check (year between 1900 and 2200)
);

create table public.bingo_cells (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  board_id      uuid not null,
  position      smallint not null,
  challenge     text not null,

  user_book_id  uuid,
  completed_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint bingo_cells_board_fk
    foreign key (user_id, board_id)
    references public.bingo_boards(user_id, id)
    on delete cascade,

  constraint bingo_cells_book_fk
    foreign key (user_id, user_book_id)
    references public.user_books(user_id, id)
    on delete restrict,

  constraint bingo_cells_position_chk check (position between 1 and 16),

  constraint bingo_cells_assignment_chk check (
    (user_book_id is null and completed_at is null)
    or
    (user_book_id is not null and completed_at is not null)
  ),

  constraint bingo_cells_position_unique
    unique (user_id, board_id, position)
);

create index bingo_cells_book_idx
  on public.bingo_cells (user_id, user_book_id)
  where user_book_id is not null;

-- ---------------------------------------------------------------------------
-- Account bootstrap
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(new.display_name), '')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_app_user_created
after insert on app.users
for each row
execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Derived projection helpers
-- ---------------------------------------------------------------------------

create or replace function private.refresh_user_book_projection(
  p_user_book_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_open_status       text;
  v_last_status       text;
  v_completed_count   integer;
  v_last_finished_at  timestamptz;
begin
  select r.status
  into v_open_status
  from public.readings r
  where r.user_book_id = p_user_book_id
    and r.ended_at is null
  order by r.started_at desc
  limit 1;

  select
    count(*) filter (where r.status = 'completed'),
    max(r.ended_at) filter (where r.status = 'completed')
  into
    v_completed_count,
    v_last_finished_at
  from public.readings r
  where r.user_book_id = p_user_book_id;

  select r.status
  into v_last_status
  from public.readings r
  where r.user_book_id = p_user_book_id
    and r.ended_at is not null
  order by r.ended_at desc
  limit 1;

  update public.user_books
  set
    completed_readings_count = v_completed_count,
    last_finished_at = v_last_finished_at,
    lifecycle_state =
      case
        when v_open_status = 'active' then 'reading'
        when v_open_status = 'paused' then 'paused'
        when v_completed_count > 0 then 'finished'
        when v_last_status = 'dnf' then 'dnf'
        else 'unread'
      end
  where id = p_user_book_id;
end;
$$;

create or replace function private.readings_projection_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_user_book_projection(old.user_book_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.user_book_id is distinct from new.user_book_id
  then
    perform private.refresh_user_book_projection(old.user_book_id);
  end if;

  perform private.refresh_user_book_projection(new.user_book_id);
  return new;
end;
$$;

create trigger readings_projection_insert
after insert on public.readings
for each row execute function private.readings_projection_trigger();

create trigger readings_projection_delete
after delete on public.readings
for each row execute function private.readings_projection_trigger();

create trigger readings_projection_update
after update of status, ended_at, user_book_id
on public.readings
for each row execute function private.readings_projection_trigger();

create or replace function private.validate_new_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_completed smallint;
  v_genre     smallint;
begin
  select completed_readings_count, genre_id
  into v_completed, v_genre
  from public.user_books
  where id = new.user_book_id
    and user_id = new.user_id;

  if not found then
    raise exception 'Book not found';
  end if;

  if v_completed < 1 then
    raise exception 'A review requires at least one completed reading';
  end if;

  new.genre_id := v_genre;
  return new;
end;
$$;

create trigger review_validate_insert
before insert on public.reviews
for each row execute function private.validate_new_review();

create or replace function private.sync_review_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.user_books
    set review_rating = null
    where id = old.user_book_id;
    return old;
  end if;

  update public.user_books
  set review_rating = new.rating
  where id = new.user_book_id;

  if tg_op = 'UPDATE'
     and old.user_book_id is distinct from new.user_book_id
  then
    update public.user_books
    set review_rating = null
    where id = old.user_book_id;
  end if;

  return new;
end;
$$;

create trigger review_rating_sync
after insert or update or delete on public.reviews
for each row execute function private.sync_review_rating();

create or replace function private.validate_review_score()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_review_genre    smallint;
  v_dimension_genre smallint;
begin
  select genre_id
  into v_review_genre
  from public.reviews
  where id = new.review_id
    and user_id = new.user_id;

  select genre_id
  into v_dimension_genre
  from public.rating_dimensions
  where dimension_key = new.dimension_key;

  if v_review_genre is distinct from v_dimension_genre then
    raise exception 'Rating dimension does not belong to review genre';
  end if;

  return new;
end;
$$;

create trigger review_score_validate
before insert or update on public.review_scores
for each row execute function private.validate_review_score();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger app_users_updated_at before update on app.users
for each row execute function private.set_updated_at();

create trigger works_updated_at before update on public.works
for each row execute function private.set_updated_at();

create trigger authors_updated_at before update on public.authors
for each row execute function private.set_updated_at();

create trigger editions_updated_at before update on public.editions
for each row execute function private.set_updated_at();

create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

create trigger custom_themes_updated_at before update on public.custom_themes
for each row execute function private.set_updated_at();

create trigger user_preferences_updated_at before update on public.user_preferences
for each row execute function private.set_updated_at();

create trigger user_books_updated_at before update on public.user_books
for each row execute function private.set_updated_at();

create trigger readings_updated_at before update on public.readings
for each row execute function private.set_updated_at();

create trigger reviews_updated_at before update on public.reviews
for each row execute function private.set_updated_at();

create trigger quotes_updated_at before update on public.quotes
for each row execute function private.set_updated_at();

create trigger bingo_boards_updated_at before update on public.bingo_boards
for each row execute function private.set_updated_at();

create trigger bingo_cells_updated_at before update on public.bingo_cells
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.genres enable row level security;
alter table public.works enable row level security;
alter table public.authors enable row level security;
alter table public.work_authors enable row level security;
alter table public.editions enable row level security;
alter table public.rating_dimensions enable row level security;
alter table public.tags enable row level security;

create policy "catalog read genres"
on public.genres for select to segnalibro_app using (true);

create policy "catalog read works"
on public.works for select to segnalibro_app using (true);

create policy "catalog read authors"
on public.authors for select to segnalibro_app using (true);

create policy "catalog read work authors"
on public.work_authors for select to segnalibro_app using (true);

create policy "catalog read editions"
on public.editions for select to segnalibro_app using (true);

create policy "catalog read rating dimensions"
on public.rating_dimensions for select to segnalibro_app using (true);

create policy "catalog read tags"
on public.tags for select to segnalibro_app using (true);

alter table public.profiles enable row level security;

create policy "profile read own"
on public.profiles for select to segnalibro_app
using (id = (select app.current_user_id()));

create policy "profile update own"
on public.profiles for update to segnalibro_app
using (id = (select app.current_user_id()))
with check (id = (select app.current_user_id()));

alter table public.user_preferences enable row level security;

create policy "preferences read own"
on public.user_preferences for select to segnalibro_app
using (user_id = (select app.current_user_id()));

create policy "preferences update own"
on public.user_preferences for update to segnalibro_app
using (user_id = (select app.current_user_id()))
with check (user_id = (select app.current_user_id()));

alter table public.custom_themes enable row level security;
alter table public.user_books enable row level security;
alter table public.reading_queue enable row level security;
alter table public.readings enable row level security;
alter table public.reviews enable row level security;
alter table public.review_scores enable row level security;
alter table public.user_book_tags enable row level security;
alter table public.quotes enable row level security;
alter table public.bingo_boards enable row level security;
alter table public.bingo_cells enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'custom_themes',
    'user_books',
    'reading_queue',
    'readings',
    'reviews',
    'review_scores',
    'user_book_tags',
    'quotes',
    'bingo_boards',
    'bingo_cells'
  ]
  loop
    execute format(
      'create policy "own rows" on public.%I
       for all to segnalibro_app
       using (user_id = (select app.current_user_id()))
       with check (user_id = (select app.current_user_id()))',
      table_name
    );
  end loop;
end;
$$;

alter table public.reading_progress_events enable row level security;

create policy "progress read own"
on public.reading_progress_events for select to segnalibro_app
using (user_id = (select app.current_user_id()));

create policy "progress insert own"
on public.reading_progress_events for insert to segnalibro_app
with check (user_id = (select app.current_user_id()));

-- ---------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY
--
-- segnalibro_app never owns these tables, so RLS already applies to it. FORCE
-- additionally subjects the table OWNER to the policies (superusers and
-- BYPASSRLS roles are exempt by definition), so a non-superuser owner cannot
-- silently bypass them either.
-- ---------------------------------------------------------------------------

alter table public.profiles force row level security;
alter table public.user_preferences force row level security;
alter table public.custom_themes force row level security;
alter table public.user_books force row level security;
alter table public.reading_queue force row level security;
alter table public.readings force row level security;
alter table public.reading_progress_events force row level security;
alter table public.reviews force row level security;
alter table public.review_scores force row level security;
alter table public.user_book_tags force row level security;
alter table public.quotes force row level security;
alter table public.bingo_boards force row level security;
alter table public.bingo_cells force row level security;

-- ---------------------------------------------------------------------------
-- Grants
--
-- The shared catalog is read-only for the runtime role: writes go through the
-- SECURITY DEFINER function app.catalog_upsert_edition() (migration 007).
-- ---------------------------------------------------------------------------

grant select on
  public.genres,
  public.works,
  public.authors,
  public.work_authors,
  public.editions,
  public.rating_dimensions,
  public.tags
to segnalibro_app;

grant select on public.profiles, public.user_preferences to segnalibro_app;

grant update (display_name, locale, timezone) on public.profiles to segnalibro_app;

grant update (theme_key, custom_theme_id, shelf_mode, motion_preference)
on public.user_preferences to segnalibro_app;

grant select, insert, update, delete on
  public.custom_themes,
  public.user_books,
  public.reading_queue,
  public.readings,
  public.reviews,
  public.review_scores,
  public.user_book_tags,
  public.quotes,
  public.bingo_boards,
  public.bingo_cells
to segnalibro_app;

grant select, insert on public.reading_progress_events to segnalibro_app;

commit;
