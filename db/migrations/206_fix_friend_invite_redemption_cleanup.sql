-- Segnalibro
-- Migration 206: keep redeemed invite invariants valid when an account is deleted.

begin;

alter table public.friend_invites
  drop constraint friend_invites_redeemed_by_fkey;

alter table public.friend_invites
  add constraint friend_invites_redeemed_by_fkey
  foreign key (redeemed_by) references app.users(id) on delete cascade;

commit;
