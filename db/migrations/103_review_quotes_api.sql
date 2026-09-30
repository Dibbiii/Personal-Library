-- Segnalibro
-- Migration 103: API per citazioni e dati di riferimento della recensione.
--
-- Additiva e idempotente (create or replace + grant). Non tocca tabelle né RPC esistenti.
--   get_review_reference()             tag attivi + dimensioni di rating attive (sola lettura)
--   add_quote(book, body, page)        richiede almeno una lettura completata (come save_review)
--   update_quote(quote, body, page)
--   delete_quote(quote)
-- Tutte SECURITY DEFINER, filtrate da private.require_uid(); `quotes` ha RLS FORCE e il trigger
-- quotes_updated_at si occupa di updated_at.

begin;

create or replace function private.contract_quote_json(p_quote public.quotes)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_quote.id,
    'userBookId', p_quote.user_book_id,
    'body', p_quote.body,
    'page', p_quote.page,
    'createdAt', p_quote.created_at,
    'updatedAt', p_quote.updated_at
  );
$$;

create or replace function public.get_review_reference()
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
    'tags', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', t.id, 'slug', t.slug, 'label', t.label_it)
          order by t.sort_order, t.id
        )
        from public.tags t
        where t.is_active
      ),
      '[]'::jsonb
    ),
    'dimensions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'dimensionKey', rd.dimension_key,
            'genreSlug', g.slug,
            'label', rd.label_it,
            'sortOrder', rd.sort_order,
            'version', rd.version
          )
          order by g.sort_order, rd.sort_order, rd.dimension_key
        )
        from public.rating_dimensions rd
        join public.genres g on g.id = rd.genre_id
        where rd.is_active
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.add_quote(
  p_book_id uuid,
  p_body text,
  p_page integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_uid();
  v_body      text := btrim(coalesce(p_body, ''));
  v_completed smallint;
  v_quote     public.quotes;
begin
  if v_body = '' or char_length(v_body) > 5000 then
    raise exception 'Quote body must be 1 to 5000 characters';
  end if;

  if p_page is not null and p_page <= 0 then
    raise exception 'Quote page must be positive';
  end if;

  select ub.completed_readings_count
    into v_completed
  from public.user_books ub
  where ub.id = p_book_id
    and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if v_completed < 1 then
    raise exception 'Quotes require at least one completed reading' using errcode = '55000';
  end if;

  insert into public.quotes (user_id, user_book_id, body, page)
  values (v_uid, p_book_id, v_body, p_page)
  returning * into v_quote;

  return jsonb_build_object(
    'contractVersion', 1,
    'quote', private.contract_quote_json(v_quote)
  );
end;
$$;

create or replace function public.update_quote(
  p_quote_id uuid,
  p_body text,
  p_page integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := private.require_uid();
  v_body  text := btrim(coalesce(p_body, ''));
  v_quote public.quotes;
begin
  if v_body = '' or char_length(v_body) > 5000 then
    raise exception 'Quote body must be 1 to 5000 characters';
  end if;

  if p_page is not null and p_page <= 0 then
    raise exception 'Quote page must be positive';
  end if;

  update public.quotes q
  set body = v_body,
      page = p_page
  where q.id = p_quote_id
    and q.user_id = v_uid
  returning * into v_quote;

  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'quote', private.contract_quote_json(v_quote)
  );
end;
$$;

create or replace function public.delete_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  delete from public.quotes q
  where q.id = p_quote_id
    and q.user_id = v_uid;

  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('contractVersion', 1, 'ok', true);
end;
$$;

revoke all on function private.contract_quote_json(public.quotes) from public;
revoke execute on function public.get_review_reference() from public;
revoke execute on function public.add_quote(uuid, text, integer) from public;
revoke execute on function public.update_quote(uuid, text, integer) from public;
revoke execute on function public.delete_quote(uuid) from public;

grant execute on function public.get_review_reference() to segnalibro_app;
grant execute on function public.add_quote(uuid, text, integer) to segnalibro_app;
grant execute on function public.update_quote(uuid, text, integer) to segnalibro_app;
grant execute on function public.delete_quote(uuid) to segnalibro_app;

commit;
