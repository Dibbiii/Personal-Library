-- Segnalibro
-- Migration 205: friendship foundation and friend-library privacy.
--
-- Invitation tokens are generated server-side by PostgreSQL but only their SHA-256
-- digest is persisted. Redeeming a token marks it used in the same transaction
-- that creates the friendship, so a token cannot be replayed.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Library visibility
-- ---------------------------------------------------------------------------

alter table public.user_preferences
  add column if not exists friend_library_visibility text not null default 'private';

alter table public.user_preferences
  add constraint user_preferences_friend_library_visibility_chk
  check (friend_library_visibility in ('private', 'friends'));

-- ---------------------------------------------------------------------------
-- Friendship graph and single-use invitations
--
-- `user_id` and `friend_id` are kept in canonical UUID order. This makes a
-- friendship undirected and guarantees exactly one row for each pair.
-- ---------------------------------------------------------------------------

create table public.friendships (
  user_id    uuid not null references app.users(id) on delete cascade,
  friend_id  uuid not null references app.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, friend_id),
  constraint friendships_distinct_users_chk check (user_id <> friend_id),
  constraint friendships_canonical_order_chk check (user_id < friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id, user_id);

create table public.friend_invites (
  id          uuid primary key default gen_random_uuid(),
  inviter_id  uuid not null references app.users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references app.users(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint friend_invites_token_hash_chk check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint friend_invites_redemption_chk check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

create index friend_invites_inviter_idx on public.friend_invites (inviter_id, created_at desc);
create index friend_invites_redeemable_idx
  on public.friend_invites (token_hash)
  where redeemed_at is null;

-- ---------------------------------------------------------------------------
-- RLS: tables are not a direct application API. The policies intentionally
-- constrain any future direct access; all mutations below are through RPCs.
-- ---------------------------------------------------------------------------

alter table public.friendships enable row level security;
alter table public.friendships force row level security;
alter table public.friend_invites enable row level security;
alter table public.friend_invites force row level security;

create policy "friendships read participants"
  on public.friendships for select to segnalibro_app
  using (
    user_id = (select app.current_user_id())
    or friend_id = (select app.current_user_id())
  );

create policy "friendships delete participants"
  on public.friendships for delete to segnalibro_app
  using (
    user_id = (select app.current_user_id())
    or friend_id = (select app.current_user_id())
  );

create policy "friend invites read inviter"
  on public.friend_invites for select to segnalibro_app
  using (inviter_id = (select app.current_user_id()));

revoke all on table public.friendships, public.friend_invites from public;
revoke all on table public.friendships, public.friend_invites from segnalibro_app;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_friendships()
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
    'friendships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', other_user_id,
          'displayName', p.display_name,
          'createdAt', f.created_at,
          'libraryVisibility', pref.friend_library_visibility
        )
        order by coalesce(p.display_name, ''), other_user_id
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

create or replace function public.create_friend_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_token text := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_invite public.friend_invites%rowtype;
begin
  insert into public.friend_invites (inviter_id, token_hash, expires_at)
  values (
    v_uid,
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    now() + interval '7 days'
  )
  returning * into v_invite;

  return jsonb_build_object(
    'contractVersion', 1,
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'token', v_token,
      'expiresAt', v_invite.expires_at
    )
  );
end;
$$;

create or replace function public.redeem_friend_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_hash text;
  v_invite public.friend_invites%rowtype;
  v_low uuid;
  v_high uuid;
  v_friend_display_name text;
  v_friend_visibility text;
  v_created_at timestamptz;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Invalid friend invite token' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into v_invite
  from public.friend_invites
  where token_hash = v_hash
    and redeemed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Friend invite not found or already used' using errcode = 'P0002';
  end if;

  if v_invite.inviter_id = v_uid then
    raise exception 'You cannot redeem your own friend invite' using errcode = '22023';
  end if;

  v_low := least(v_invite.inviter_id, v_uid);
  v_high := greatest(v_invite.inviter_id, v_uid);

  if exists (
    select 1 from public.friendships where user_id = v_low and friend_id = v_high
  ) then
    raise exception 'Friendship already exists' using errcode = '23505';
  end if;

  insert into public.friendships (user_id, friend_id)
  values (v_low, v_high)
  returning created_at into v_created_at;

  update public.friend_invites
  set redeemed_at = now(), redeemed_by = v_uid
  where id = v_invite.id;

  select p.display_name, pref.friend_library_visibility
  into v_friend_display_name, v_friend_visibility
  from public.profiles p
  join public.user_preferences pref on pref.user_id = p.id
  where p.id = v_invite.inviter_id;

  return jsonb_build_object(
    'contractVersion', 1,
    'friendship', jsonb_build_object(
      'userId', v_invite.inviter_id,
      'displayName', v_friend_display_name,
      'createdAt', v_created_at,
      'libraryVisibility', v_friend_visibility
    )
  );
end;
$$;

create or replace function public.delete_friendship(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_low uuid;
  v_high uuid;
begin
  if p_friend_id = v_uid then
    raise exception 'You cannot delete yourself as a friend' using errcode = '22023';
  end if;

  v_low := least(v_uid, p_friend_id);
  v_high := greatest(v_uid, p_friend_id);

  delete from public.friendships
  where user_id = v_low and friend_id = v_high;

  if not found then
    raise exception 'Friendship not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('contractVersion', 1, 'ok', true);
end;
$$;

create or replace function public.set_friend_library_visibility(p_visibility text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_visibility not in ('private', 'friends') then
    raise exception 'Unsupported friend library visibility' using errcode = '22023';
  end if;

  update public.user_preferences
  set friend_library_visibility = p_visibility
  where user_id = v_uid;

  if not found then
    raise exception 'Preferences not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'contractVersion', 1,
    'friendLibraryVisibility', p_visibility
  );
end;
$$;

-- The application can invoke only the public RPC surface; table access and all
-- helpers remain unavailable to PUBLIC and to the runtime role.
revoke all on function public.get_friendships() from public;
revoke all on function public.create_friend_invite() from public;
revoke all on function public.redeem_friend_invite(text) from public;
revoke all on function public.delete_friendship(uuid) from public;
revoke all on function public.set_friend_library_visibility(text) from public;

grant execute on function public.get_friendships() to segnalibro_app;
grant execute on function public.create_friend_invite() to segnalibro_app;
grant execute on function public.redeem_friend_invite(text) to segnalibro_app;
grant execute on function public.delete_friendship(uuid) to segnalibro_app;
grant execute on function public.set_friend_library_visibility(text) to segnalibro_app;

commit;
