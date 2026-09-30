-- 105: liste e creazione per Statistiche / Bingo / Citazioni (additiva).
--
--   public.list_quotes(book, limit, offset)   elenco globale delle citazioni con libro/autore/genere
--   public.list_bingo_boards()                card Bingo dell'utente (una per anno) con stato delle caselle
--   public.create_bingo_board(year)           nuova card annuale con le 16 sfide di default
--
-- Stesso modello delle RPC esistenti: security definer, search_path vuoto, utente da
-- private.require_uid(), JSON camelCase con contractVersion 1, grant solo a segnalibro_app.

create or replace function public.list_quotes(
  p_book_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return jsonb_build_object(
    'contractVersion', 1,
    'total', (
      select count(*)::integer
      from public.quotes q
      where q.user_id = v_uid
        and (p_book_id is null or q.user_book_id = p_book_id)
    ),
    'quotes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', x.id,
            'userBookId', x.user_book_id,
            'body', x.body,
            'page', x.page,
            'createdAt', x.created_at,
            'updatedAt', x.updated_at,
            'bookTitle', x.title,
            'author', x.author_display,
            'genre', private.contract_genre_json(x.genre_id)
          )
          order by x.created_at desc, x.id desc
        )
        from (
          select
            q.id,
            q.user_book_id,
            q.body,
            q.page,
            q.created_at,
            q.updated_at,
            ub.title,
            ub.author_display,
            ub.genre_id
          from public.quotes q
          join public.user_books ub
            on ub.id = q.user_book_id
           and ub.user_id = q.user_id
          where q.user_id = v_uid
            and (p_book_id is null or q.user_book_id = p_book_id)
          order by q.created_at desc, q.id desc
          limit v_limit offset v_offset
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.list_bingo_boards()
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
    'boards', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'boardId', b.id,
            'year', b.year,
            'title', b.title,
            'completedCount', (
              select count(*)::integer
              from public.bingo_cells c
              where c.user_id = b.user_id
                and c.board_id = b.id
                and c.completed_at is not null
            ),
            'totalCount', 16,
            'completedPositions', coalesce(
              (
                select jsonb_agg(c.position order by c.position)
                from public.bingo_cells c
                where c.user_id = b.user_id
                  and c.board_id = b.id
                  and c.completed_at is not null
              ),
              '[]'::jsonb
            )
          )
          order by b.year desc
        )
        from public.bingo_boards b
        where b.user_id = v_uid
      ),
      '[]'::jsonb
    )
  );
end;
$$;


create or replace function public.create_bingo_board(p_year integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_board_id uuid;
  v_challenges constant text[] := array[
    'Oltre 500 pagine',
    'Bestseller',
    'Diventato un film',
    'Letto in digitale',
    '5 stelle',
    'Premio letterario',
    'Poesia',
    'Narratore inaffidabile',
    'Un classico',
    'Retelling mitologico',
    'Thriller o giallo',
    'Titolo di una parola',
    'Dark Academia',
    'Colpo di scena',
    'Letto in viaggio',
    'Libro da BookTok'
  ];
begin
  if p_year is null or p_year < 1900 or p_year > 2200 then
    raise exception 'Invalid bingo year' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.bingo_boards b
    where b.user_id = v_uid and b.year = p_year
  ) then
    raise exception 'Bingo board already exists for this year' using errcode = '23505';
  end if;

  insert into public.bingo_boards (user_id, year, title)
  values (v_uid, p_year, 'La card del ' || p_year::text)
  returning id into v_board_id;

  insert into public.bingo_cells (user_id, board_id, position, challenge)
  select v_uid, v_board_id, g.i, v_challenges[g.i]
  from generate_series(1, 16) as g(i);

  return public.get_bingo_board(p_year);
end;
$$;


revoke execute on function public.list_quotes(uuid, integer, integer) from public;
revoke execute on function public.list_bingo_boards() from public;
revoke execute on function public.create_bingo_board(integer) from public;

grant execute on function public.list_quotes(uuid, integer, integer) to segnalibro_app;
grant execute on function public.list_bingo_boards() to segnalibro_app;
grant execute on function public.create_bingo_board(integer) to segnalibro_app;
