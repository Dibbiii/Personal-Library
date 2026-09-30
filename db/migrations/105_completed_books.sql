-- 105: libri con almeno una lettura completata (candidati per le caselle del Bookish Bingo).
-- Stessa regola di assign_bingo_book: completed_readings_count > 0. Ricerca opzionale su titolo/autore.

create or replace function public.list_completed_books(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_term text := nullif(btrim(coalesce(p_query, '')), '');
begin
  return jsonb_build_object(
    'contractVersion', 1,
    'books', coalesce(
      (
        select jsonb_agg(
          private.contract_book_summary_json(v_uid, x.id)
          order by x.last_finished desc nulls last, lower(x.title), x.id
        )
        from (
          select
            ub.id,
            ub.title,
            (
              select max(r.ended_at)
              from public.readings r
              where r.user_id = ub.user_id
                and r.user_book_id = ub.id
                and r.status = 'completed'
            ) as last_finished
          from public.user_books ub
          where ub.user_id = v_uid
            and ub.completed_readings_count > 0
            and (
              v_term is null
              or ub.title ilike '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
              or ub.author_display ilike '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
            )
          order by last_finished desc nulls last, lower(ub.title), ub.id
          limit v_limit
        ) x
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.list_completed_books(text, integer) from public;
grant execute on function public.list_completed_books(text, integer) to segnalibro_app;
