-- Card Bingo personalizzabili: titolo e 16 sfide modificabili, cancellazione della card.
begin;

create or replace function public.update_bingo_board(
  p_year integer,
  p_title text,
  p_challenges jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_board_id uuid;
  v_title text := nullif(btrim(p_title), '');
  v_row record;
begin
  if p_year is null or p_year < 1900 or p_year > 2200 then
    raise exception 'Invalid bingo year' using errcode = '22023';
  end if;
  if v_title is null or char_length(v_title) > 80 then
    raise exception 'Bingo title must be 1-80 characters' using errcode = '22023';
  end if;
  if p_challenges is null or jsonb_typeof(p_challenges) <> 'array' or jsonb_array_length(p_challenges) <> 16 then
    raise exception 'Bingo requires exactly 16 challenges' using errcode = '22023';
  end if;

  select b.id into v_board_id
  from public.bingo_boards b
  where b.user_id = v_uid and b.year = p_year
  for update;

  if not found then
    raise exception 'Bingo board not found' using errcode = 'P0002';
  end if;

  update public.bingo_boards set title = v_title where id = v_board_id and user_id = v_uid;

  for v_row in
    select (x.ord)::smallint as position, btrim(x.challenge) as challenge
    from jsonb_array_elements_text(p_challenges) with ordinality as x(challenge, ord)
  loop
    if v_row.challenge = '' or char_length(v_row.challenge) > 120 then
      raise exception 'Each challenge must be 1-120 characters' using errcode = '22023';
    end if;
    update public.bingo_cells
    set challenge = v_row.challenge
    where user_id = v_uid and board_id = v_board_id and position = v_row.position;
  end loop;

  return public.get_bingo_board(p_year);
end;
$$;

create or replace function public.delete_bingo_board(p_year integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  delete from public.bingo_boards
  where user_id = v_uid and year = p_year;
  if not found then
    raise exception 'Bingo board not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('contractVersion', 1, 'ok', true);
end;
$$;

revoke all on function public.update_bingo_board(integer, text, jsonb) from public;
revoke all on function public.delete_bingo_board(integer) from public;
grant execute on function public.update_bingo_board(integer, text, jsonb) to segnalibro_app;
grant execute on function public.delete_bingo_board(integer) to segnalibro_app;

commit;
