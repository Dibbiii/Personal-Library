-- Additive read models: bounded payloads, global counts, independent genre pages.
-- Keep the original RPCs available for older clients and rollback.
create collation if not exists private.it_numeric (
  provider = icu, locale = 'it-u-kn-true-ks-level1', deterministic = false
);

create function public.get_queue_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return jsonb_build_object('contractVersion',1,'ids',coalesce((
    select jsonb_agg(user_book_id order by position) from public.reading_queue where user_id=v_uid
  ),'[]'::jsonb));
end $$;

create function public.get_discovery_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return jsonb_build_object('contractVersion',1,'owned',coalesce((
    select jsonb_agg(jsonb_build_object('id',id,'title',title,'author',author_display) order by id)
    from public.user_books where user_id=v_uid
  ),'[]'::jsonb),'topGenres',coalesce((
    select jsonb_agg(slug order by n desc,id) from (
      select g.slug,g.id,count(*) n from public.user_books ub join public.genres g on g.id=ub.genre_id
      where ub.user_id=v_uid group by g.id,g.slug order by n desc,g.id limit 2
    ) x
  ),'[]'::jsonb));
end $$;

create function public.get_profile_dnf()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_uid();
begin
  return jsonb_build_object('contractVersion',1,'books',coalesce((
    select jsonb_agg(jsonb_build_object('book',private.contract_book_summary_json(v_uid,x.id),
      'stoppedAtPage',nullif(x.current_page,0),'dnfAt',x.ended_at) order by x.ended_at desc,x.id)
    from (
      select ub.id,r.current_page,r.ended_at from public.user_books ub
      join lateral (select current_page,ended_at from public.readings
        where user_id=v_uid and user_book_id=ub.id and status='dnf'
        order by ended_at desc,id limit 1) r on true
      where ub.user_id=v_uid and ub.lifecycle_state='dnf' and ub.completed_readings_count=0
    ) x
  ),'[]'::jsonb));
end $$;

create function public.get_profile_summary(p_collections boolean default true,p_activity_limit integer default 4)
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
      union all select 'queued',user_book_id,created_at from public.reading_queue where user_id=v_uid
      union all select 'dnf',id,ended_at from dnf
    )
    select jsonb_build_object('contractVersion',1,
      'counts',jsonb_build_object(
        'total',count(*),'read',count(*) filter(where completed_readings_count>0),
        'reading',(select count(*) from reading),
        'unread',count(*) filter(where lifecycle_state='unread' and completed_readings_count=0),
        'physical',count(*) filter(where format='physical'),'digital',count(*) filter(where format='digital'),
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

create function public.get_quotes_page(p_book_id uuid default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
  v_total integer;
  v_page integer;
begin
  select count(*) into v_total from public.quotes where user_id=v_uid and (p_book_id is null or user_book_id=p_book_id);
  v_page := least(greatest(coalesce(p_page,1),1),greatest(1,(v_total+29)/30));
  return public.list_quotes(p_book_id,30,(v_page-1)*30) || jsonb_build_object(
    'page',v_page,'pageSize',30,'books',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'title',title) order by title collate private.it_numeric,id)
      from public.user_books ub where ub.user_id=v_uid
      and exists(select 1 from public.quotes q where q.user_id=v_uid and q.user_book_id=ub.id)
    ),'[]'::jsonb));
end $$;

create function public.get_genre_pages(p_genre_slug text,p_sort_field text default 'rating',p_sort_direction text default 'desc',
  p_unread_sort text default 'title',p_read_page integer default 1,p_unread_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid(); v_gid smallint; v_counts jsonb; v_read integer; v_unread integer;
  v_read_page integer; v_unread_page integer; v_read_books jsonb; v_unread_books jsonb;
  v_order text; v_unread_order text;
begin
  select id into v_gid from public.genres where slug=p_genre_slug and is_active;
  if v_gid is null then raise exception 'Genre not found' using errcode='P0002'; end if;
  if p_sort_field is null or p_sort_field not in ('title','author','pages','rating','date')
     or p_sort_direction is null or p_sort_direction not in ('asc','desc')
     or p_unread_sort is null or p_unread_sort not in ('title','author','pages','date') then
    raise exception 'Invalid sort' using errcode='22023';
  end if;
  select count(*) filter(where completed_readings_count>0), count(*) filter(where completed_readings_count=0)
    into v_read,v_unread from public.user_books where user_id=v_uid and genre_id=v_gid;
  v_read_page := least(greatest(coalesce(p_read_page,1),1),greatest(1,(v_read+39)/40));
  v_unread_page := least(greatest(coalesce(p_unread_page,1),1),greatest(1,(v_unread+39)/40));
  v_order := (case p_sort_field when 'title' then 'lower(title)' when 'author' then 'lower(author_display)'
    when 'pages' then 'page_count' when 'rating' then 'review_rating' else 'coalesce(last_finished_at,created_at)' end)
    || ' ' || p_sort_direction || ' nulls last,id';
  v_unread_order := case p_unread_sort
    when 'author' then 'regexp_replace(btrim(author_display),''^.*\s'','''') collate private.it_numeric,title collate private.it_numeric,id'
    when 'pages' then 'page_count asc nulls last,title collate private.it_numeric,id'
    when 'date' then 'last_activity_at desc nulls last,title collate private.it_numeric,id'
    else 'title collate private.it_numeric,id' end;
  -- ORDER BY fragments come exclusively from the allow-lists above; values stay bound.
  execute format('select coalesce(jsonb_agg(private.contract_book_summary_json($1,id) order by seq),''[]''::jsonb)
    from (select id,row_number() over(order by %s) seq from public.user_books
      where user_id=$1 and genre_id=$2 and completed_readings_count>0 order by %s limit 40 offset $3) x',v_order,v_order)
    into v_read_books using v_uid,v_gid,(v_read_page-1)*40;
  execute format('select coalesce(jsonb_agg(private.contract_book_summary_json($1,id) order by seq),''[]''::jsonb)
    from (select id,row_number() over(order by %s) seq from public.user_books
      where user_id=$1 and genre_id=$2 and completed_readings_count=0 order by %s limit 40 offset $3) x',v_unread_order,v_unread_order)
    into v_unread_books using v_uid,v_gid,(v_unread_page-1)*40;
  return jsonb_build_object('contractVersion',1,'genre',private.user_genre_json(v_uid,v_gid),
    'counts',jsonb_build_object('total',v_read+v_unread,'read',v_read,'unread',v_unread),
    'sort',jsonb_build_object('field',p_sort_field,'direction',p_sort_direction),'unreadSort',p_unread_sort,
    'pages',jsonb_build_object('read',v_read_page,'unread',v_unread_page,'pageSize',40),
    'sections',jsonb_build_array(jsonb_build_object('key','read','count',v_read,'books',v_read_books),
      jsonb_build_object('key','unread','count',v_unread,'books',v_unread_books)));
end $$;

revoke execute on function public.get_queue_summary() from public;
revoke execute on function public.get_discovery_context() from public;
revoke execute on function public.get_profile_dnf() from public;
revoke execute on function public.get_profile_summary(boolean,integer) from public;
revoke execute on function public.get_quotes_page(uuid,integer) from public;
revoke execute on function public.get_genre_pages(text,text,text,text,integer,integer) from public;
grant execute on function public.get_queue_summary() to segnalibro_app;
grant execute on function public.get_discovery_context() to segnalibro_app;
grant execute on function public.get_profile_dnf() to segnalibro_app;
grant execute on function public.get_profile_summary(boolean,integer) to segnalibro_app;
grant execute on function public.get_quotes_page(uuid,integer) to segnalibro_app;
grant execute on function public.get_genre_pages(text,text,text,text,integer,integer) to segnalibro_app;
