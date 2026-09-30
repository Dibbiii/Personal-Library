-- Segnalibro
-- Migration 107: impostazioni, temi custom ed export dati (MASTER_SPEC sezioni 21, 36, 41).
--
-- Additiva: nessuna tabella nuova. Aggiunge solo funzioni RPC pubbliche
-- (SECURITY DEFINER, filtrate da private.require_uid()):
--   get_user_settings / update_user_settings   nome, modalità scaffali, movimento, tema
--   list_custom_themes / save_custom_theme / delete_custom_theme
--   export_user_data                            export JSON completo dell'utente

begin;

-- ---------------------------------------------------------------------------
-- Impostazioni utente
-- ---------------------------------------------------------------------------

create or replace function public.get_user_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_uid();
  v_name  text;
  v_pref  public.user_preferences%rowtype;
begin
  select coalesce(p.display_name, u.display_name)
  into v_name
  from app.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_uid;

  select * into v_pref from public.user_preferences x where x.user_id = v_uid;
  if not found then
    raise exception 'Preferences not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'displayName', v_name,
    'shelfMode', v_pref.shelf_mode,
    'motionPreference', v_pref.motion_preference,
    'selection', public.get_theme_selection() -> 'selection'
  );
end;
$$;

create or replace function public.update_user_settings(
  p_display_name      text default null,
  p_shelf_mode        text default null,
  p_motion_preference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_uid();
  v_name text := nullif(btrim(p_display_name), '');
begin
  if p_display_name is not null then
    if v_name is null or char_length(v_name) > 80 then
      raise exception 'Display name must be 1-80 characters';
    end if;

    update public.profiles set display_name = v_name where id = v_uid;
    update app.users set display_name = v_name where id = v_uid;
  end if;

  if p_shelf_mode is not null then
    if p_shelf_mode not in ('hybrid', 'spines', 'covers') then
      raise exception 'Unsupported shelf mode';
    end if;
    update public.user_preferences set shelf_mode = p_shelf_mode where user_id = v_uid;
  end if;

  if p_motion_preference is not null then
    if p_motion_preference not in ('system', 'reduce', 'full') then
      raise exception 'Unsupported motion preference';
    end if;
    update public.user_preferences
    set motion_preference = p_motion_preference
    where user_id = v_uid;
  end if;

  return public.get_user_settings();
end;
$$;

-- ---------------------------------------------------------------------------
-- Temi custom: JSON di token validato dall'app (mai CSS arbitrario)
-- ---------------------------------------------------------------------------

create or replace function public.list_custom_themes()
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
    'themes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'schemaVersion', t.schema_version,
          'tokens', t.tokens
        )
        order by t.created_at, t.id
      )
      from public.custom_themes t
      where t.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_custom_theme(
  p_name           text,
  p_tokens         jsonb,
  p_schema_version smallint default 1,
  p_id             uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.custom_themes%rowtype;
begin
  if p_id is null then
    if (select count(*) from public.custom_themes t where t.user_id = v_uid) >= 20 then
      raise exception 'Too many custom themes';
    end if;

    insert into public.custom_themes (user_id, name, schema_version, tokens)
    values (v_uid, btrim(p_name), p_schema_version, p_tokens)
    returning * into v_row;
  else
    update public.custom_themes t
    set name = btrim(p_name),
        schema_version = p_schema_version,
        tokens = p_tokens
    where t.id = p_id and t.user_id = v_uid
    returning * into v_row;

    if not found then
      raise exception 'Custom theme not found' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'theme', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'schemaVersion', v_row.schema_version,
      'tokens', v_row.tokens
    )
  );
end;
$$;

create or replace function public.delete_custom_theme(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  -- Un tema ancora selezionato non si può eliminare (FK): si torna al built-in salvato.
  update public.user_preferences
  set custom_theme_id = null
  where user_id = v_uid and custom_theme_id = p_id;

  delete from public.custom_themes t where t.id = p_id and t.user_id = v_uid;
  if not found then
    raise exception 'Custom theme not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('contractVersion', 1, 'ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Export completo (privacy, sezione 41)
-- ---------------------------------------------------------------------------

create or replace function public.export_user_data()
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
    'format', 'segnalibro-export',
    'exportedAt', now(),

    'profile', (
      select jsonb_build_object(
        'displayName', coalesce(p.display_name, u.display_name),
        'email', u.email,
        'locale', p.locale,
        'timezone', p.timezone,
        'createdAt', u.created_at
      )
      from app.users u
      left join public.profiles p on p.id = u.id
      where u.id = v_uid
    ),

    'preferences', (
      select jsonb_build_object(
        'themeKey', x.theme_key,
        'customThemeId', x.custom_theme_id,
        'shelfMode', x.shelf_mode,
        'motionPreference', x.motion_preference
      )
      from public.user_preferences x
      where x.user_id = v_uid
    ),

    'customThemes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id, 'name', t.name, 'schemaVersion', t.schema_version,
          'tokens', t.tokens, 'createdAt', t.created_at
        ) order by t.created_at, t.id
      )
      from public.custom_themes t where t.user_id = v_uid
    ), '[]'::jsonb),

    'books', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'title', b.title,
          'author', b.author_display,
          'genre', g.slug,
          'genreName', g.name_it,
          'pageCount', b.page_count,
          'language', b.language,
          'isbn10', b.isbn_10,
          'isbn13', b.isbn_13,
          'format', b.format,
          'seriesName', b.series_name,
          'seriesNumber', b.series_number,
          'seriesTotal', b.series_total,
          'coverUrl', b.cover_url,
          'hasCustomCover', b.cover_storage_path is not null,
          'source', b.source,
          'lifecycleState', b.lifecycle_state,
          'completedReadingsCount', b.completed_readings_count,
          'rating', b.review_rating,
          'lastFinishedAt', b.last_finished_at,
          'lastActivityAt', b.last_activity_at,
          'createdAt', b.created_at,
          'tags', coalesce((
            select jsonb_agg(tg.slug order by tg.sort_order)
            from public.user_book_tags ubt
            join public.tags tg on tg.id = ubt.tag_id
            where ubt.user_id = v_uid and ubt.user_book_id = b.id
          ), '[]'::jsonb)
        ) order by b.created_at, b.id
      )
      from public.user_books b
      join public.genres g on g.id = b.genre_id
      where b.user_id = v_uid
    ), '[]'::jsonb),

    'queue', coalesce((
      select jsonb_agg(
        jsonb_build_object('bookId', q.user_book_id, 'position', q.position, 'addedAt', q.added_at)
        order by q.position
      )
      from public.reading_queue q where q.user_id = v_uid
    ), '[]'::jsonb),

    'readings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id, 'bookId', r.user_book_id, 'status', r.status,
          'startedAt', r.started_at, 'endedAt', r.ended_at,
          'startPage', r.start_page, 'currentPage', r.current_page
        ) order by r.started_at, r.id
      )
      from public.readings r where r.user_id = v_uid
    ), '[]'::jsonb),

    'progressEvents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventId', e.id, 'readingId', e.reading_id, 'type', e.event_type,
          'page', e.page, 'pageDelta', e.page_delta,
          'localDate', e.local_date, 'occurredAt', e.occurred_at
        ) order by e.occurred_at, e.id
      )
      from public.reading_progress_events e where e.user_id = v_uid
    ), '[]'::jsonb),

    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rv.id, 'bookId', rv.user_book_id, 'rating', rv.rating,
          'adjectives', to_jsonb(rv.adjectives),
          'genre', g.slug,
          'scores', coalesce((
            select jsonb_agg(
              jsonb_build_object('dimension', s.dimension_key, 'score', s.score)
              order by s.dimension_key
            )
            from public.review_scores s
            where s.user_id = v_uid and s.review_id = rv.id
          ), '[]'::jsonb),
          'createdAt', rv.created_at, 'updatedAt', rv.updated_at
        ) order by rv.created_at, rv.id
      )
      from public.reviews rv
      join public.genres g on g.id = rv.genre_id
      where rv.user_id = v_uid
    ), '[]'::jsonb),

    'quotes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qt.id, 'bookId', qt.user_book_id, 'text', qt.body,
          'page', qt.page, 'createdAt', qt.created_at
        ) order by qt.created_at, qt.id
      )
      from public.quotes qt where qt.user_id = v_uid
    ), '[]'::jsonb),

    'bingoBoards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', bb.id, 'year', bb.year, 'title', bb.title,
          'cells', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'position', c.position, 'challenge', c.challenge,
                'bookId', c.user_book_id, 'completedAt', c.completed_at
              ) order by c.position
            )
            from public.bingo_cells c
            where c.user_id = v_uid and c.board_id = bb.id
          ), '[]'::jsonb)
        ) order by bb.year
      )
      from public.bingo_boards bb where bb.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegi: solo il ruolo applicativo
-- ---------------------------------------------------------------------------

revoke execute on function public.get_user_settings() from public;
revoke execute on function public.update_user_settings(text, text, text) from public;
revoke execute on function public.list_custom_themes() from public;
revoke execute on function public.save_custom_theme(text, jsonb, smallint, uuid) from public;
revoke execute on function public.delete_custom_theme(uuid) from public;
revoke execute on function public.export_user_data() from public;

grant execute on function public.get_user_settings() to segnalibro_app;
grant execute on function public.update_user_settings(text, text, text) to segnalibro_app;
grant execute on function public.list_custom_themes() to segnalibro_app;
grant execute on function public.save_custom_theme(text, jsonb, smallint, uuid) to segnalibro_app;
grant execute on function public.delete_custom_theme(uuid) to segnalibro_app;
grant execute on function public.export_user_data() to segnalibro_app;

commit;
