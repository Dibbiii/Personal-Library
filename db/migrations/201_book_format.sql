-- Permette di indicare che lo stesso libro è posseduto sia in formato cartaceo sia digitale.
-- I valori esistenti restano validi e non richiedono trasformazioni.
begin;

alter table public.user_books
  drop constraint user_books_format_chk,
  add constraint user_books_format_chk
    check (format in ('physical', 'digital', 'both'));

create or replace function public.change_book_format(
  p_book_id uuid,
  p_format text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_format not in ('physical', 'digital', 'both') then
    raise exception 'Invalid book format' using errcode = '22023';
  end if;

  update public.user_books
  set format = p_format
  where id = p_book_id
    and user_id = v_uid;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'book', private.contract_book_summary_json(v_uid, p_book_id)
  );
end;
$$;

revoke all on function public.change_book_format(uuid, text) from public;
grant execute on function public.change_book_format(uuid, text) to segnalibro_app;

commit;
