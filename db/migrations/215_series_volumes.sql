begin;

create or replace function private.contract_series_books_json(
  p_user_id uuid,
  p_book_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'title', member.title,
        'number', member.series_number
      )
      order by member.series_number nulls last, lower(member.title), member.id
    ),
    '[]'::jsonb
  )
  from public.user_books target
  join public.user_books member
    on member.user_id = target.user_id
   and lower(btrim(member.series_name)) = lower(btrim(target.series_name))
  where target.id = p_book_id
    and target.user_id = p_user_id
    and target.series_name is not null
$$;

revoke all on function private.contract_series_books_json(uuid, uuid) from public;

create or replace function public.get_book_detail(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_book jsonb;
  v_queue_position integer;
begin
  v_book := private.contract_book_summary_json(v_uid, p_book_id);

  if v_book is null then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  select q.position into v_queue_position
  from public.reading_queue q
  where q.user_id = v_uid
    and q.user_book_id = p_book_id;

  return jsonb_build_object(
    'contractVersion', 1,
    'book', v_book,
    'seriesBooks', private.contract_series_books_json(v_uid, p_book_id),
    'queuePosition', v_queue_position,

    'currentReading', (
      select private.contract_reading_json(v_uid, r.id)
      from public.readings r
      where r.user_id = v_uid
        and r.user_book_id = p_book_id
        and r.ended_at is null
      order by r.started_at desc, r.id desc
      limit 1
    ),

    'readings', coalesce(
      (
        select jsonb_agg(
          private.contract_reading_json(v_uid, x.id)
          || jsonb_build_object('sequence', x.sequence)
          order by x.started_at desc, x.id desc
        )
        from (
          select
            r.id,
            r.started_at,
            row_number() over (
              order by r.started_at asc, r.id asc
            )::integer as sequence
          from public.readings r
          where r.user_id = v_uid
            and r.user_book_id = p_book_id
        ) x
      ),
      '[]'::jsonb
    ),

    'review', private.contract_review_json(v_uid, p_book_id),

    'quotes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'userBookId', q.user_book_id,
            'body', q.body,
            'page', q.page,
            'createdAt', q.created_at,
            'updatedAt', q.updated_at
          )
          order by q.created_at desc, q.id desc
        )
        from public.quotes q
        where q.user_id = v_uid
          and q.user_book_id = p_book_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_book_detail(uuid) from public;
grant execute on function public.get_book_detail(uuid) to segnalibro_app;

commit;
