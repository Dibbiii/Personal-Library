# Contract testing — Segnalibro

The contract suite is intentionally split into two layers.

## 1. Pure Zod tests

These do not require a database:

```bash
npm install
npm run test:contracts
```

They verify the shape assumptions themselves, including:

- `BookSummary`;
- Library Home;
- shelf pagination;
- Genre View;
- Book Detail;
- reading mutations;
- review mutations;
- queue soft-limit response;
- calendar and annual statistics;
- dashboard;
- 16-cell Bingo;
- the default `Segnalibro` theme.

## 2. Real Supabase/PostgreSQL contract tests

These are the important tests for CI. They execute the real RPCs and then feed
those real JSON payloads into the exact Zod schemas used by SvelteKit.

### Local setup

```bash
supabase start
supabase db reset
```

Export the values printed by:

```bash
supabase status
```

Example:

```bash
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_ANON_KEY='...'
export SUPABASE_SERVICE_ROLE_KEY='...'
export SUPABASE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
```

Then:

```bash
npm run test:contracts:db
```

The DB suite creates a disposable authenticated user, seeds a private library,
calls the RPCs through Supabase just like the application will, validates every
response through Zod, and deletes the user afterwards.

## What the integration suite covers

The suite currently exercises:

1. `get_library_home`
2. `get_shelf_page`
3. `queue_add` and its soft 3-book limit
4. `queue_move`
5. `start_reading`
6. `record_progress`
7. retry/idempotency with the same event UUID
8. `correct_progress`
9. `pause_reading`
10. `resume_reading`
11. `finish_reading`
12. `save_review`
13. `get_book_detail`
14. `get_genre_view`
15. `add_completed_reading`
16. `mark_dnf`
17. `get_reading_calendar`
18. `get_year_stats`
19. `get_explore_pool`
20. `get_bingo_board`
21. `assign_bingo_book`
22. `change_book_genre`
23. `get_stats_dashboard`
24. `get_theme_selection`
25. `set_theme_selection`

## Why this is useful

A migration such as:

```sql
jsonb_build_object('page_count', ub.page_count)
```

instead of:

```sql
jsonb_build_object('pageCount', ub.page_count)
```

will make CI fail immediately with a Zod contract error.

This gives us a stable boundary:

```text
PostgreSQL migration
      ↓
real Supabase RPC
      ↓
real JSON payload
      ↓
Zod schema used by frontend
      ↓
PASS / FAIL
```

The UI therefore never needs to trust an undocumented database shape.
