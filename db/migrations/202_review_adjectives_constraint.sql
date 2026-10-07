-- Allinea il vincolo di tabella alla RPC: da zero a tre aggettivi, non vuoti e distinti.
begin;

create or replace function private.valid_review_adjectives(p_adjectives text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(p_adjectives) <= 3
    and not exists (
      select 1
      from unnest(p_adjectives) as a(adjective)
      where btrim(adjective) = ''
    )
    and (
      select count(distinct lower(btrim(adjective)))
      from unnest(p_adjectives) as a(adjective)
    ) = cardinality(p_adjectives);
$$;

alter table public.reviews drop constraint reviews_adjectives_chk;
alter table public.reviews add constraint reviews_adjectives_chk
  check (private.valid_review_adjectives(adjectives));

commit;
