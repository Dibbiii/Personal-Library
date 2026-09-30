-- 105: ripartizione per genere delle letture completate in un anno (barra segmentata di Statistiche).
-- Stessa definizione di get_year_stats: letture 'completed' chiuse nell'anno (fuso del profilo),
-- quindi la somma coincide con booksFinished e il primo elemento con topGenre.

create or replace function public.get_year_genre_breakdown(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_tz text;
begin
  if p_year not between 1900 and 2200 then
    raise exception 'Invalid year' using errcode = '22023';
  end if;

  select coalesce(p.timezone, 'UTC') into v_tz
  from public.profiles p
  where p.id = v_uid;

  v_tz := coalesce(v_tz, 'UTC');

  return jsonb_build_object(
    'contractVersion', 1,
    'year', p_year,
    'genres', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'genre', private.contract_genre_json(x.genre_id),
            'booksFinished', x.reading_count
          )
          order by x.reading_count desc, x.sort_order
        )
        from (
          select
            g.id as genre_id,
            g.sort_order,
            count(*)::integer as reading_count
          from public.readings r
          join public.user_books ub
            on ub.id = r.user_book_id
           and ub.user_id = r.user_id
          join public.genres g on g.id = ub.genre_id
          where r.user_id = v_uid
            and r.status = 'completed'
            and r.ended_at is not null
            and extract(year from (r.ended_at at time zone v_tz))::integer = p_year
          group by g.id, g.sort_order
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_year_genre_breakdown(integer) from public;
grant execute on function public.get_year_genre_breakdown(integer) to segnalibro_app;
