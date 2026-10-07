-- Le helper private non devono essere invocabili dal ruolo PUBLIC.
begin;

revoke all on function private.valid_review_adjectives(text[]) from public;

commit;
