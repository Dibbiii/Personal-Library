-- Elimina solo il libro dell'utente autenticato, mantenendo le sfide del Bingo.
begin;

create or replace function public.remove_book(p_book_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_cover_path text;
  v_reading_ids jsonb;
  v_cleared integer;
begin
  select ub.cover_storage_path into v_cover_path
  from public.user_books ub
  where ub.id = p_book_id and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  -- Stesso ordine di lock di start_reading: libro, poi coda dell'utente.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || v_uid::text, 0)
  );

  select coalesce(jsonb_agg(r.id order by r.id), '[]'::jsonb)
  into v_reading_ids
  from public.readings r
  where r.user_id = v_uid and r.user_book_id = p_book_id;

  update public.bingo_cells
  set user_book_id = null, completed_at = null
  where user_id = v_uid and user_book_id = p_book_id;
  get diagnostics v_cleared = row_count;

  -- Letture, eventi, recensioni, tag, citazioni e voce in coda sono ON DELETE CASCADE.
  delete from public.user_books where user_id = v_uid and id = p_book_id;
  perform private.compact_reading_queue(v_uid);

  return jsonb_build_object(
    'contractVersion', 1,
    'bookId', p_book_id,
    'readingIds', v_reading_ids,
    'clearedBingoCells', v_cleared,
    'coverStoragePath', v_cover_path
  );
end;
$$;

revoke all on function public.remove_book(uuid) from public;
grant execute on function public.remove_book(uuid) to segnalibro_app;

commit;
