begin;

-- Converge i totali duplicati al valore noto più alto quando copre tutti i volumi;
-- se i dati storici sono incompatibili, lascia il totale sconosciuto anziché inventarlo.
with series_totals as (
  select
    user_id,
    lower(btrim(series_name)) as series_key,
    case
      when max(series_number) is null then max(series_total)
      when max(series_total) >= max(series_number) then max(series_total)
      else null::smallint
    end as total
  from public.user_books
  where series_name is not null
    and btrim(series_name) <> ''
  group by user_id, lower(btrim(series_name))
)
update public.user_books as book
set series_total = totals.total
from series_totals as totals
where book.user_id = totals.user_id
  and lower(btrim(book.series_name)) = totals.series_key;

create or replace function public.change_book_series(
  p_book_id uuid,
  p_series_name text,
  p_series_number numeric,
  p_series_total smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_series_name text := nullif(btrim(p_series_name), '');
begin
  if v_series_name is null then
    if p_series_number is not null or p_series_total is not null then
      raise exception 'Series name is required for volume metadata' using errcode = '22023';
    end if;
  else
    if char_length(v_series_name) > 160 then
      raise exception 'Series name is too long' using errcode = '22023';
    end if;
    if p_series_number is not null and (p_series_number <= 0 or p_series_number > 9999) then
      raise exception 'Invalid series volume number' using errcode = '22023';
    end if;
    if p_series_number is not null and p_series_number <> round(p_series_number, 2) then
      raise exception 'Series volume number supports at most two decimal places' using errcode = '22023';
    end if;
    if p_series_total is not null and (p_series_total <= 0 or p_series_total > 999) then
      raise exception 'Invalid series volume total' using errcode = '22023';
    end if;
    if p_series_number is not null
      and p_series_total is not null
      and p_series_number > p_series_total
    then
      raise exception 'Series volume number exceeds total' using errcode = '22023';
    end if;
    if p_series_total is not null and exists (
      select 1
      from public.user_books member
      where member.user_id = v_uid
        and member.id <> p_book_id
        and lower(btrim(member.series_name)) = lower(btrim(v_series_name))
        and member.series_number > p_series_total
    ) then
      raise exception 'Series total is below an assigned volume' using errcode = '22023';
    end if;
  end if;

  update public.user_books
  set series_name = v_series_name,
      series_number = case when v_series_name is null then null else p_series_number end,
      series_total = case when v_series_name is null then null else p_series_total end
  where id = p_book_id
    and user_id = v_uid;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if v_series_name is not null then
    update public.user_books
    set series_total = p_series_total
    where user_id = v_uid
      and lower(btrim(series_name)) = lower(btrim(v_series_name));
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'book', private.contract_book_summary_json(v_uid, p_book_id)
  );
end;
$$;

revoke all on function public.change_book_series(uuid, text, numeric, smallint) from public;
grant execute on function public.change_book_series(uuid, text, numeric, smallint) to segnalibro_app;

commit;
