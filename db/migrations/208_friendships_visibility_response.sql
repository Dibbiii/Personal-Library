-- Include la visibilità dell'utente corrente nel read model amici, senza esporre nuove tabelle.
begin;

create or replace function public.get_friendships()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_visibility text;
begin
  select friend_library_visibility into v_visibility
  from public.user_preferences
  where user_id = v_uid;

  return jsonb_build_object(
    'contractVersion', 1,
    'visibility', v_visibility,
    'friendships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', other_user_id,
          'displayName', p.display_name,
          'createdAt', f.created_at,
          'libraryVisibility', pref.friend_library_visibility
        ) order by coalesce(p.display_name, ''), other_user_id
      )
      from public.friendships f
      cross join lateral (
        select case when f.user_id = v_uid then f.friend_id else f.user_id end as other_user_id
      ) other
      join public.profiles p on p.id = other.other_user_id
      join public.user_preferences pref on pref.user_id = other.other_user_id
      where f.user_id = v_uid or f.friend_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_friendships() from public;
grant execute on function public.get_friendships() to segnalibro_app;

commit;
