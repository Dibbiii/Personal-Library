-- Keep the physical unread count in the complete profile read model, not in
-- paginated shelf data.
create or replace function public.get_profile_summary(p_collections boolean default true,p_activity_limit integer default 4)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return (
    with books as materialized (select * from public.user_books where user_id=v_uid),
    reading as materialized (select r.* from public.readings r where r.user_id=v_uid and r.status in ('active','paused')),
    dnf as materialized (
      select ub.id,r.current_page,r.ended_at from books ub
      join lateral (select current_page,ended_at from public.readings
        where user_id=v_uid and user_book_id=ub.id and status='dnf'
        order by ended_at desc,id limit 1) r on true
      where ub.lifecycle_state='dnf' and ub.completed_readings_count=0
    ), activity as (
      select 'finished' kind,id book_id,last_finished_at at from books where last_finished_at is not null
      union all select 'started',user_book_id,started_at from reading
      union all select 'queued',user_book_id,added_at from public.reading_queue where user_id=v_uid
      union all select 'dnf',id,ended_at from dnf
    )
    select jsonb_build_object('contractVersion',1,
      'counts',jsonb_build_object(
        'total',count(*),'read',count(*) filter(where completed_readings_count>0),
        'reading',(select count(*) from reading),
        'unread',count(*) filter(where lifecycle_state='unread' and completed_readings_count=0),
        'physical',count(*) filter(where format='physical'),
        'physicalUnread',count(*) filter(where format='physical' and lifecycle_state='unread' and completed_readings_count=0),
        'digital',count(*) filter(where format='digital'),
        'both',count(*) filter(where format='both'),
        'englishRead',count(*) filter(where completed_readings_count>0 and language ~* '^(en|eng)(-|$)'),
        'reread',count(*) filter(where completed_readings_count>1)),
      'queueCount',(select count(*) from public.reading_queue where user_id=v_uid),
      'quoteCount',(select count(*) from public.quotes where user_id=v_uid),
      'dnfCount',(select count(*) from dnf),
      'favorites',case when p_collections then coalesce((select jsonb_agg(private.contract_book_summary_json(v_uid,id) order by review_rating desc,last_finished_at desc nulls last,id)
        from (select id,review_rating,last_finished_at from books where review_rating is not null order by review_rating desc,last_finished_at desc nulls last,id limit 5) x),'[]'::jsonb) else '[]'::jsonb end,
      'queue',case when p_collections then coalesce((select jsonb_agg(private.contract_book_summary_json(v_uid,user_book_id) order by position)
        from (select user_book_id,position from public.reading_queue where user_id=v_uid order by position limit 3) x),'[]'::jsonb) else '[]'::jsonb end,
      'reading',case when p_collections then coalesce((select jsonb_agg(private.contract_book_summary_json(v_uid,user_book_id) order by started_at desc,id)
        from (select * from reading order by started_at desc,id limit 3) x),'[]'::jsonb) else '[]'::jsonb end,
      'dnf',case when p_collections then coalesce((select jsonb_agg(jsonb_build_object('book',private.contract_book_summary_json(v_uid,id),'stoppedAtPage',nullif(current_page,0),'dnfAt',ended_at) order by ended_at desc,id)
        from (select * from dnf order by ended_at desc,id limit 3) x),'[]'::jsonb) else '[]'::jsonb end,
      'activity',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'book',private.contract_book_summary_json(v_uid,book_id),'at',at) order by at desc,book_id,kind)
        from (select * from activity order by at desc,book_id,kind limit least(greatest(coalesce(p_activity_limit,4),0),30)) x),'[]'::jsonb)
    ) from books
  );
end $$;
