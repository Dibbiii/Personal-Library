-- Consente voti da 0,5 a 5 in incrementi di mezza stella.
begin;

alter table public.user_books drop constraint user_books_review_rating_chk;
alter table public.user_books alter column review_rating type numeric(2,1) using review_rating::numeric(2,1);
alter table public.user_books add constraint user_books_review_rating_chk check (
  review_rating is null
  or (review_rating between 0.5 and 5 and mod(review_rating, 0.5) = 0)
);

alter table public.reviews drop constraint reviews_rating_chk;
alter table public.reviews alter column rating type numeric(2,1) using rating::numeric(2,1);
alter table public.reviews add constraint reviews_rating_chk check (
  rating between 0.5 and 5 and mod(rating, 0.5) = 0
);

alter table public.review_scores drop constraint review_scores_score_chk;
alter table public.review_scores alter column score type numeric(2,1) using score::numeric(2,1);
alter table public.review_scores add constraint review_scores_score_chk check (
  score between 0.5 and 5 and mod(score, 0.5) = 0
);

-- PostgreSQL non permette di cambiare il tipo degli argomenti con CREATE OR REPLACE:
-- creiamo la nuova firma e rimuoviamo quelle smallint dopo aver trasferito la logica.
create or replace function private.legacy_save_review(
  p_user_book_id uuid,
  p_rating numeric,
  p_adjectives text[],
  p_scores jsonb default '[]'::jsonb,
  p_tag_ids smallint[] default '{}'::smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := private.require_uid();
  v_genre_id    smallint;
  v_completed   smallint;
  v_review_id   uuid;
  v_adjectives  text[];
  v_score       record;
  v_tag_count   integer;
begin
  if p_rating not between 0.5 and 5 or mod(p_rating, 0.5) <> 0 then
    raise exception 'rating must be between 0.5 and 5 in half-star increments';
  end if;

  select ub.genre_id, ub.completed_readings_count
    into v_genre_id, v_completed
  from public.user_books ub
  where ub.id = p_user_book_id and ub.user_id = v_uid
  for update;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  if v_completed < 1 then
    raise exception 'Review requires at least one completed reading' using errcode = '55000';
  end if;

  select array_agg(x.adjective order by x.ord)
    into v_adjectives
  from (
    select btrim(u.adjective) as adjective, u.ord
    from unnest(p_adjectives) with ordinality as u(adjective, ord)
  ) x;

  if cardinality(v_adjectives) <> 3
     or exists (select 1 from unnest(v_adjectives) a where a is null or a = '')
     or (select count(distinct lower(a)) from unnest(v_adjectives) a) <> 3
  then
    raise exception 'Exactly 3 distinct non-empty adjectives are required';
  end if;

  insert into public.reviews (user_id, user_book_id, genre_id, rating, adjectives)
  values (v_uid, p_user_book_id, v_genre_id, p_rating, v_adjectives)
  on conflict (user_id, user_book_id)
  do update set
    genre_id = excluded.genre_id,
    rating = excluded.rating,
    adjectives = excluded.adjectives
  returning id into v_review_id;

  delete from public.review_scores rs
  where rs.user_id = v_uid and rs.review_id = v_review_id;

  if p_scores is null then p_scores := '[]'::jsonb; end if;
  if jsonb_typeof(p_scores) <> 'array' then
    raise exception 'scores must be a JSON array';
  end if;

  for v_score in
    select * from jsonb_to_recordset(p_scores) as x(dimension_key text, score numeric)
  loop
    if v_score.score not between 0.5 and 5 or mod(v_score.score, 0.5) <> 0 then
      raise exception 'Every dimension score must be between 0.5 and 5 in half-star increments';
    end if;
    if not exists (
      select 1 from public.rating_dimensions rd
      where rd.dimension_key = v_score.dimension_key
        and rd.genre_id = v_genre_id
        and rd.is_active
    ) then
      raise exception 'Invalid rating dimension: %', v_score.dimension_key;
    end if;

    insert into public.review_scores (user_id, review_id, dimension_key, score)
    values (v_uid, v_review_id, v_score.dimension_key, v_score.score);
  end loop;

  delete from public.user_book_tags ubt
  where ubt.user_id = v_uid and ubt.user_book_id = p_user_book_id;

  if cardinality(coalesce(p_tag_ids, '{}'::smallint[])) > 0 then
    select count(*)::integer into v_tag_count
    from public.tags t
    where t.id = any(p_tag_ids) and t.is_active;

    if v_tag_count <> (select count(distinct x) from unnest(p_tag_ids) x) then
      raise exception 'One or more tag IDs are invalid';
    end if;

    insert into public.user_book_tags (user_id, user_book_id, tag_id)
    select v_uid, p_user_book_id, x
    from (select distinct unnest(p_tag_ids) as x) d;
  end if;

  return jsonb_build_object(
    'reviewId', v_review_id,
    'bookId', p_user_book_id,
    'rating', p_rating,
    'adjectives', to_jsonb(v_adjectives),
    'genreId', v_genre_id
  );
end;
$$;

create or replace function public.save_review(
  p_book_id uuid,
  p_rating numeric,
  p_adjectives text[],
  p_scores jsonb default '[]'::jsonb,
  p_tag_ids smallint[] default '{}'::smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  perform private.legacy_save_review(
    p_book_id,
    p_rating,
    p_adjectives,
    coalesce(p_scores, '[]'::jsonb),
    coalesce(p_tag_ids, '{}'::smallint[])
  );

  return jsonb_build_object(
    'contractVersion', 1,
    'review', private.contract_review_json(v_uid, p_book_id)
  );
end;
$$;

drop function public.save_review(uuid, smallint, text[], jsonb, smallint[]);
drop function private.legacy_save_review(uuid, smallint, text[], jsonb, smallint[]);

revoke all on function public.save_review(uuid, numeric, text[], jsonb, smallint[]) from public;
grant execute on function public.save_review(uuid, numeric, text[], jsonb, smallint[]) to segnalibro_app;

commit;
