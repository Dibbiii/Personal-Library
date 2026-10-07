-- Le funzioni PostgreSQL nuove sono eseguibili da PUBLIC per default: la helper deve restare privata.
begin;

revoke all on function private.legacy_save_review(uuid, numeric, text[], jsonb, smallint[]) from public;

commit;
