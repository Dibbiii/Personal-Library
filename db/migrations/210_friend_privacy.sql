-- Privacy granulare per gli amici e read model del profilo condiviso.
begin;

alter table public.user_preferences
  add column if not exists friend_reviews_visibility text not null default 'private',
  add column if not exists friend_stats_visibility text not null default 'private',
  add column if not exists friend_quotes_visibility text not null default 'private',
  add column if not exists friend_activity_visibility text not null default 'private';

alter table public.user_preferences
  add constraint user_preferences_friend_reviews_visibility_chk
    check (friend_reviews_visibility in ('private', 'friends')),
  add constraint user_preferences_friend_stats_visibility_chk
    check (friend_stats_visibility in ('private', 'friends')),
  add constraint user_preferences_friend_quotes_visibility_chk
    check (friend_quotes_visibility in ('private', 'friends')),
  add constraint user_preferences_friend_activity_visibility_chk
    check (friend_activity_visibility in ('private', 'friends'));

create or replace function public.set_friend_visibility(
  p_library text default null,
  p_reviews text default null,
  p_stats text default null,
  p_quotes text default null,
  p_activity text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_library is not null and p_library not in ('private', 'friends')
     or p_reviews is not null and p_reviews not in ('private', 'friends')
     or p_stats is not null and p_stats not in ('private', 'friends')
     or p_quotes is not null and p_quotes not in ('private', 'friends')
     or p_activity is not null and p_activity not in ('private', 'friends') then
    raise exception 'Invalid visibility' using errcode = '22023';
  end if;

  update public.user_preferences
  set
    friend_library_visibility = coalesce(p_library, friend_library_visibility),
    friend_reviews_visibility = coalesce(p_reviews, friend_reviews_visibility),
    friend_stats_visibility = coalesce(p_stats, friend_stats_visibility),
    friend_quotes_visibility = coalesce(p_quotes, friend_quotes_visibility),
    friend_activity_visibility = coalesce(p_activity, friend_activity_visibility)
  where user_id = v_uid;

  return public.get_friend_privacy();
end;
$$;

create or replace function public.get_friend_privacy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_pref public.user_preferences%rowtype;
begin
  select * into v_pref from public.user_preferences where user_id = v_uid;
  return jsonb_build_object(
    'contractVersion', 1,
    'library', v_pref.friend_library_visibility,
    'reviews', v_pref.friend_reviews_visibility,
    'stats', v_pref.friend_stats_visibility,
    'quotes', v_pref.friend_quotes_visibility,
    'activity', v_pref.friend_activity_visibility
  );
end;
$$;

-- Profilo visibile solo a un amico confermato. Ogni sezione rispetta la privacy del proprietario.
create or replace function public.get_friend_profile(p_friend_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_pref public.user_preferences%rowtype;
  v_name text;
begin
  if not exists (
    select 1 from public.friendships f
    where (f.user_id = v_uid and f.friend_id = p_friend_id)
       or (f.friend_id = v_uid and f.user_id = p_friend_id)
  ) then
    raise exception 'Friend not found' using errcode = 'P0002';
  end if;

  select * into v_pref from public.user_preferences where user_id = p_friend_id;
  select coalesce(p.display_name, u.display_name) into v_name
  from app.users u left join public.profiles p on p.id = u.id
  where u.id = p_friend_id;

  return jsonb_build_object(
    'contractVersion', 1,
    'userId', p_friend_id,
    'displayName', v_name,
    'privacy', jsonb_build_object(
      'library', v_pref.friend_library_visibility,
      'reviews', v_pref.friend_reviews_visibility,
      'stats', v_pref.friend_stats_visibility,
      'quotes', v_pref.friend_quotes_visibility,
      'activity', v_pref.friend_activity_visibility
    ),
    'library', case when v_pref.friend_library_visibility = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'author', b.author_display,
        'format', b.format, 'lifecycleState', b.lifecycle_state,
        'rating', b.review_rating
      ) order by b.title), '[]'::jsonb)
      from public.user_books b where b.user_id = p_friend_id
    ) else null end,
    'reviews', case when v_pref.friend_reviews_visibility = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bookId', rv.user_book_id, 'rating', rv.rating, 'adjectives', to_jsonb(rv.adjectives)
      ) order by rv.updated_at desc), '[]'::jsonb)
      from public.reviews rv where rv.user_id = p_friend_id
    ) else null end,
    'stats', case when v_pref.friend_stats_visibility = 'friends' then jsonb_build_object(
      'booksFinished', (select count(*) from public.user_books b where b.user_id = p_friend_id and b.completed_readings_count > 0),
      'dnf', (select count(*) from public.user_books b where b.user_id = p_friend_id and b.lifecycle_state = 'dnf')
    ) else null end,
    'quotes', case when v_pref.friend_quotes_visibility = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'body', q.body, 'page', q.page
      ) order by q.created_at desc), '[]'::jsonb)
      from public.quotes q where q.user_id = p_friend_id
    ) else null end,
    'activity', case when v_pref.friend_activity_visibility = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bookId', b.id, 'title', b.title, 'at', b.last_activity_at
      ) order by b.last_activity_at desc nulls last), '[]'::jsonb)
      from public.user_books b
      where b.user_id = p_friend_id and b.last_activity_at is not null
    ) else null end
  );
end;
$$;

revoke all on function public.get_friend_privacy() from public;
revoke all on function public.set_friend_visibility(text, text, text, text, text) from public;
revoke all on function public.get_friend_profile(uuid) from public;
grant execute on function public.get_friend_privacy() to segnalibro_app;
grant execute on function public.set_friend_visibility(text, text, text, text, text) to segnalibro_app;
grant execute on function public.get_friend_profile(uuid) to segnalibro_app;

commit;
