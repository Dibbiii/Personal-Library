-- Segnalibro
-- Migration 005: make account deletion (DELETE FROM app.users) work.
--
-- MASTER_SPEC section 41 requires that "delete account" stays possible.
-- Running the real contract suite showed it was not, for independent reasons
-- (found against the original package, kept here because they are schema bugs):
--
-- 1. bingo_cells_book_fk was ON DELETE RESTRICT.
--    RESTRICT is checked immediately, but the cascade from app.users reaches
--    user_books before bingo_cells, so any user with an assigned Bingo cell
--    could not be deleted. Plain NO ACTION does not help either (the per-row
--    cascade query still trips the check), so the constraint becomes
--    DEFERRABLE INITIALLY DEFERRED: it is verified at commit, after every
--    cascade finished. Deleting a single book that is still assigned to a cell
--    is refused as before (now at commit time instead of at the statement).
--
-- 2. Projection triggers ran with the privileges of the caller.
--    Deleting readings/reviews fires private.readings_projection_trigger() and
--    private.sync_review_rating(), which update user_books. Being SECURITY
--    INVOKER they executed as whoever deleted the row, which has no access to
--    the `private` schema. They become SECURITY DEFINER (search_path is already
--    pinned to '').
--
-- 3. user_preferences_custom_theme_fk was ON DELETE RESTRICT.
--    Deleting an account cascades to custom_themes and user_preferences; with
--    an active custom theme RESTRICT could fire before the preferences row was
--    removed. It becomes NO ACTION DEFERRABLE INITIALLY DEFERRED (verified at
--    commit). Removing a custom theme that is still selected stays refused.
--
-- The public contract (RPC names / JSON shapes) is unchanged.

begin;

alter table public.bingo_cells
  drop constraint bingo_cells_book_fk;

alter table public.bingo_cells
  add constraint bingo_cells_book_fk
  foreign key (user_id, user_book_id)
  references public.user_books (user_id, id)
  on delete no action
  deferrable initially deferred;

alter table public.user_preferences
  drop constraint user_preferences_custom_theme_fk;

alter table public.user_preferences
  add constraint user_preferences_custom_theme_fk
  foreign key (user_id, custom_theme_id)
  references public.custom_themes (user_id, id)
  on delete no action
  deferrable initially deferred;

alter function private.readings_projection_trigger() security definer;
alter function private.sync_review_rating() security definer;

commit;
