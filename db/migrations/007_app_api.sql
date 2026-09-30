-- Segnalibro
-- Migration 007: server-side API in the `app` schema.
--
-- segnalibro_app has NO direct privileges on app.users / app.sessions nor on
-- the catalog tables' write side. Everything it may do there goes through the
-- SECURITY DEFINER functions below (search_path = '', EXECUTE revoked from
-- PUBLIC and granted to segnalibro_app only).
--
--   * register_user / find_user_for_login / create_session / validate_session /
--     delete_session / delete_account: accounts and sessions (src/lib/server/auth)
--   * catalog_upsert_edition: the only write path into works / authors /
--     work_authors / editions (MASTER_SPEC section 29: "catalogo globale: read per
--     utenti autenticati, write solo server/domain layer").
--
-- Only opaque hashes cross this boundary: password hashing (scrypt) and the
-- sha256 of session tokens are computed by the application server.

begin;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create or replace function app.register_user(
  p_email          text,
  p_password_hash  text,
  p_display_name   text default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  with ins as (
    insert into app.users (email, password_hash, display_name)
    values (p_email, p_password_hash, nullif(btrim(p_display_name), ''))
    returning id, email, display_name
  )
  select jsonb_build_object(
    'id', ins.id,
    'email', ins.email,
    'displayName', ins.display_name
  )
  from ins
$$;

create or replace function app.find_user_for_login(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'displayName', u.display_name,
    'passwordHash', u.password_hash
  )
  from app.users u
  where u.email = p_email
$$;

-- Account deletion (privacy: MASTER_SPEC section 41). Removes the user and, via
-- ON DELETE CASCADE, every row they own. Callable only for the user set in
-- app.user_id for the current transaction.
create or replace function app.delete_account(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or app.current_user_id() is distinct from p_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from app.users where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

create or replace function app.create_session(
  p_user_id     uuid,
  p_token_hash  text,
  p_expires_at  timestamptz
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- opportunistic cleanup keeps the table small without a cron job
  delete from app.sessions
  where user_id = p_user_id
    and expires_at <= now();

  insert into app.sessions (user_id, token_hash, expires_at)
  values (p_user_id, p_token_hash, p_expires_at);

  update app.users
  set last_login_at = now()
  where id = p_user_id;

  return p_expires_at;
end;
$$;

-- Returns the session owner, or NULL for an unknown/expired token.
-- Sliding expiration: when the session was last extended more than 5 minutes
-- ago, expires_at is pushed to now() + p_ttl_seconds (one write per 5 minutes
-- at most, not one per request).
create or replace function app.validate_session(
  p_token_hash   text,
  p_ttl_seconds  integer
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  with s as (
    select x.id, x.user_id, x.expires_at, x.last_used_at
    from app.sessions x
    where x.token_hash = p_token_hash
      and x.expires_at > now()
  ),
  bump as (
    update app.sessions x
    set last_used_at = now(),
        expires_at = now() + make_interval(secs => p_ttl_seconds)
    from s
    where x.id = s.id
      and s.last_used_at < now() - interval '5 minutes'
    returning x.id, x.expires_at
  )
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'displayName', u.display_name,
    'expiresAt', coalesce(b.expires_at, s.expires_at)
  )
  from s
  join app.users u on u.id = s.user_id
  left join bump b on b.id = s.id
$$;

create or replace function app.delete_session(p_token_hash text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from app.sessions where token_hash = p_token_hash
$$;

-- Maintenance helper for the admin role (not granted to segnalibro_app).
create or replace function app.purge_expired_sessions()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with d as (
    delete from app.sessions where expires_at <= now() returning 1
  )
  select count(*)::integer from d
$$;

-- ---------------------------------------------------------------------------
-- Shared catalog writes
--
-- Idempotent upsert of one Edition (and, when needed, its Work and Authors):
--
--   1. An existing edition is identified ONLY by a strong identifier:
--      isbn_13, isbn_10, open_library_edition_id or google_books_id. Title +
--      author never merge two editions (MASTER_SPEC section 19). A hit is only
--      ENRICHED: columns that are NULL get filled, existing values are kept.
--   2. Otherwise a new edition is created under
--        * the work given in p_work_id, or
--        * the work with the same open_library_work_id, or
--        * a brand new work (with its authors).
--      Authors are reused by open_library_author_id, else by exact
--      case-insensitive name.
--
-- Writes are serialized with a transaction-level advisory lock: catalog writes
-- are rare and this avoids duplicate works/authors under concurrent imports.
-- Returns {"workId": "<bigint as string>", "editionId": "...", "created": bool}.
-- ---------------------------------------------------------------------------

create or replace function app.catalog_upsert_edition(
  p_title                    text,
  p_authors                  text[]   default '{}',
  p_original_title           text     default null,
  p_first_published_year     smallint default null,
  p_open_library_work_id     text     default null,
  p_open_library_author_ids  text[]   default null,
  p_work_id                  bigint   default null,
  p_isbn_10                  text     default null,
  p_isbn_13                  text     default null,
  p_language                 text     default null,
  p_publisher                text     default null,
  p_published_date           date     default null,
  p_published_year           smallint default null,
  p_page_count               integer  default null,
  p_google_books_id          text     default null,
  p_open_library_edition_id  text     default null,
  p_cover_provider           text     default null,
  p_cover_ref                text     default null,
  p_cover_url                text     default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_edition     public.editions%rowtype;
  v_work_id     bigint;
  v_author_id   bigint;
  v_name        text;
  v_ol_id       text;
  v_pos         integer;
  v_created     boolean := false;
begin
  if app.current_user_id() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('segnalibro.catalog_upsert', 0)
  );

  -- 1. existing edition by strong identifier (priority order)
  select e.* into v_edition
  from public.editions e
  where (p_isbn_13 is not null and e.isbn_13 = p_isbn_13)
     or (p_isbn_10 is not null and e.isbn_10 = p_isbn_10)
     or (p_open_library_edition_id is not null
         and e.open_library_edition_id = p_open_library_edition_id)
     or (p_google_books_id is not null and e.google_books_id = p_google_books_id)
  order by
    (e.isbn_13 is not distinct from p_isbn_13 and p_isbn_13 is not null) desc,
    (e.isbn_10 is not distinct from p_isbn_10 and p_isbn_10 is not null) desc,
    e.id
  limit 1;

  if found then
    update public.editions e
    set
      isbn_10 = coalesce(e.isbn_10, case
        when p_isbn_10 is not null and not exists (
          select 1 from public.editions o where o.isbn_10 = p_isbn_10 and o.id <> e.id
        ) then p_isbn_10 end),
      isbn_13 = coalesce(e.isbn_13, case
        when p_isbn_13 is not null and not exists (
          select 1 from public.editions o where o.isbn_13 = p_isbn_13 and o.id <> e.id
        ) then p_isbn_13 end),
      google_books_id = coalesce(e.google_books_id, case
        when p_google_books_id is not null and not exists (
          select 1 from public.editions o
          where o.google_books_id = p_google_books_id and o.id <> e.id
        ) then p_google_books_id end),
      open_library_edition_id = coalesce(e.open_library_edition_id, case
        when p_open_library_edition_id is not null and not exists (
          select 1 from public.editions o
          where o.open_library_edition_id = p_open_library_edition_id and o.id <> e.id
        ) then p_open_library_edition_id end),
      language        = coalesce(e.language, p_language),
      publisher       = coalesce(e.publisher, p_publisher),
      published_date  = coalesce(e.published_date, p_published_date),
      published_year  = coalesce(e.published_year, p_published_year),
      page_count      = coalesce(e.page_count, p_page_count),
      cover_provider  = coalesce(e.cover_provider, p_cover_provider),
      cover_ref       = coalesce(e.cover_ref, p_cover_ref),
      cover_url       = coalesce(e.cover_url, p_cover_url)
    where e.id = v_edition.id;

    return jsonb_build_object(
      'workId', v_edition.work_id::text,
      'editionId', v_edition.id::text,
      'created', false
    );
  end if;

  -- 2. choose / create the work
  if p_work_id is not null then
    select w.id into v_work_id from public.works w where w.id = p_work_id;
    if v_work_id is null then
      raise exception 'Work not found' using errcode = 'P0002';
    end if;
  elsif p_open_library_work_id is not null then
    select w.id into v_work_id
    from public.works w
    where w.open_library_work_id = p_open_library_work_id;
  end if;

  if v_work_id is null then
    insert into public.works (
      title, original_title, first_published_year, open_library_work_id
    )
    values (
      btrim(p_title),
      nullif(btrim(p_original_title), ''),
      p_first_published_year,
      p_open_library_work_id
    )
    returning id into v_work_id;

    v_pos := 0;
    foreach v_name in array coalesce(p_authors, '{}'::text[])
    loop
      v_pos := v_pos + 1;
      v_name := btrim(v_name);
      continue when v_name is null or v_name = '';

      v_ol_id := null;
      if p_open_library_author_ids is not null then
        v_ol_id := nullif(btrim(p_open_library_author_ids[v_pos]), '');
      end if;

      v_author_id := null;
      if v_ol_id is not null then
        select a.id into v_author_id
        from public.authors a
        where a.open_library_author_id = v_ol_id;
      end if;

      if v_author_id is null then
        select a.id into v_author_id
        from public.authors a
        where lower(a.name) = lower(v_name)
          and (a.open_library_author_id is null or v_ol_id is null)
        order by a.id
        limit 1;
      end if;

      if v_author_id is null then
        insert into public.authors (name, open_library_author_id)
        values (v_name, v_ol_id)
        returning id into v_author_id;
      end if;

      insert into public.work_authors (work_id, author_id, position)
      values (v_work_id, v_author_id, v_pos)
      on conflict do nothing;
    end loop;
  end if;

  insert into public.editions (
    work_id, isbn_10, isbn_13, language, publisher, published_date,
    published_year, page_count, google_books_id, open_library_edition_id,
    cover_provider, cover_ref, cover_url
  )
  values (
    v_work_id, p_isbn_10, p_isbn_13, p_language, p_publisher, p_published_date,
    p_published_year, p_page_count, p_google_books_id, p_open_library_edition_id,
    p_cover_provider, p_cover_ref, p_cover_url
  )
  returning * into v_edition;

  v_created := true;

  return jsonb_build_object(
    'workId', v_work_id::text,
    'editionId', v_edition.id::text,
    'created', v_created
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function app.register_user(text, text, text) from public;
revoke all on function app.find_user_for_login(text) from public;
revoke all on function app.delete_account(uuid) from public;
revoke all on function app.create_session(uuid, text, timestamptz) from public;
revoke all on function app.validate_session(text, integer) from public;
revoke all on function app.delete_session(text) from public;
revoke all on function app.purge_expired_sessions() from public;
revoke all on function app.catalog_upsert_edition(
  text, text[], text, smallint, text, text[], bigint, text, text, text, text,
  date, smallint, integer, text, text, text, text, text
) from public;

grant execute on function app.register_user(text, text, text) to segnalibro_app;
grant execute on function app.find_user_for_login(text) to segnalibro_app;
grant execute on function app.delete_account(uuid) to segnalibro_app;
grant execute on function app.create_session(uuid, text, timestamptz) to segnalibro_app;
grant execute on function app.validate_session(text, integer) to segnalibro_app;
grant execute on function app.delete_session(text) to segnalibro_app;
grant execute on function app.catalog_upsert_edition(
  text, text[], text, smallint, text, text[], bigint, text, text, text, text,
  date, smallint, integer, text, text, text, text, text
) to segnalibro_app;

commit;
