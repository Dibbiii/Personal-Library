begin;

-- Keep edition metadata updates behind an ownership-checked function: the
-- runtime role intentionally has no direct UPDATE privilege on user_books.
create or replace function public.update_book_edition(
  p_book_id uuid,
  p_edition_id bigint,
  p_title text,
  p_author_display text,
  p_page_count integer,
  p_language text,
  p_isbn_10 text,
  p_isbn_13 text,
  p_cover_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_edition_id is null
    or nullif(btrim(p_title), '') is null
    or nullif(btrim(p_author_display), '') is null
    or (p_page_count is not null and p_page_count <= 0)
  then
    raise exception 'Invalid edition metadata' using errcode = '22023';
  end if;

  update public.user_books
  set edition_id = p_edition_id,
      title = btrim(p_title),
      author_display = btrim(p_author_display),
      page_count = p_page_count,
      language = p_language,
      isbn_10 = p_isbn_10,
      isbn_13 = p_isbn_13,
      cover_url = p_cover_url
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

revoke all on function public.update_book_edition(
  uuid, bigint, text, text, integer, text, text, text, text
) from public;
grant execute on function public.update_book_edition(
  uuid, bigint, text, text, integer, text, text, text, text
) to segnalibro_app;

commit;
