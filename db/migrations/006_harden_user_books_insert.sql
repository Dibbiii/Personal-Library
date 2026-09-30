-- Segnalibro
-- Migration 006: column-level INSERT grant on user_books.
--
-- Migration 002 already revoked UPDATE on the derived projection columns
-- (lifecycle_state, completed_readings_count, review_rating, last_finished_at,
-- last_activity_at) from the runtime role, but INSERT stayed table-wide: a
-- caller could create a book that claims to be "finished" with no reading
-- history. Projections must only ever be produced by the database (triggers /
-- RPCs), so INSERT is restricted to the same user-editable columns plus the
-- identity ones.
--
-- Adding a book remains a plain INSERT with these columns (RLS still forces
-- user_id = app.current_user_id()).

begin;

revoke insert on public.user_books from segnalibro_app;

grant insert (
  id,
  user_id,
  edition_id,
  genre_id,
  title,
  author_display,
  page_count,
  language,
  isbn_10,
  isbn_13,
  format,
  series_name,
  series_number,
  series_total,
  cover_url,
  cover_storage_path,
  source
)
on table public.user_books
to segnalibro_app;

commit;
