import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bingoBoardResponseSchema,
  bookDetailResponseSchema,
  explorePoolResponseSchema,
  genreChangeResponseSchema,
  genreViewResponseSchema,
  libraryHomeResponseSchema,
  queueAddResponseSchema,
  queueMutationResponseSchema,
  readingCalendarResponseSchema,
  readingMutationResultSchema,
  reviewSaveResultSchema,
  shelfPageResponseSchema,
  statsDashboardResponseSchema,
  themeMutationResponseSchema,
  yearStatsResponseSchema,
} from '../../src/lib/contracts';
import { createContractFixture, type ContractFixture } from '../helpers/fixture';
import { expectRpcContract } from '../helpers/rpc';

const runDb = process.env.RUN_DB_CONTRACT_TESTS === '1';

(runDb ? describe.sequential : describe.skip)('Supabase RPC contract v1', () => {
  let fx: ContractFixture;
  let fantasyReadingId: string;

  beforeAll(async () => {
    fx = await createContractFixture();
  });

  afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  it('get_library_home matches the Zod contract', async () => {
    const home = await expectRpcContract(
      fx.client,
      'get_library_home',
      { p_shelf_limit: 24 },
      libraryHomeResponseSchema,
    );

    expect(home.contractVersion).toBe(1);
    expect(home.shelves).toHaveLength(7);
  });

  it('get_shelf_page uses the keyset contract', async () => {
    const page = await expectRpcContract(
      fx.client,
      'get_shelf_page',
      {
        p_genre_slug: 'fantasy-magical-gothic',
        p_cursor_created_at: null,
        p_cursor_id: null,
        p_limit: 1,
      },
      shelfPageResponseSchema,
    );

    expect(page.data.genre.slug).toBe('fantasy-magical-gothic');
    expect(page.data.books[0]?.id).toBe(fx.books.fantasy);
  });

  it('implements the soft queue limit without corrupting the queue', async () => {
    for (const bookId of [fx.books.mythology, fx.books.classic, fx.books.romance]) {
      const result = await expectRpcContract(
        fx.client,
        'queue_add',
        { p_book_id: bookId, p_force: false },
        queueAddResponseSchema,
      );
      expect(result.status).toBe('added');
    }

    const confirmation = await expectRpcContract(
      fx.client,
      'queue_add',
      { p_book_id: fx.books.thriller, p_force: false },
      queueAddResponseSchema,
    );

    expect(confirmation.status).toBe('requiresConfirmation');
    expect(confirmation.currentCount).toBe(3);
    expect(confirmation.position).toBeNull();

    const forced = await expectRpcContract(
      fx.client,
      'queue_add',
      { p_book_id: fx.books.thriller, p_force: true },
      queueAddResponseSchema,
    );

    expect(forced.status).toBe('added');
    expect(forced.queue).toHaveLength(4);

    const moved = await expectRpcContract(
      fx.client,
      'queue_move',
      { p_book_id: fx.books.thriller, p_new_position: 1 },
      queueMutationResponseSchema,
    );
    expect(moved.queue[0]?.book.id).toBe(fx.books.thriller);
  });

  it('start/pause/resume/progress/correction/finish all return one reading contract', async () => {
    const started = await expectRpcContract(
      fx.client,
      'start_reading',
      {
        p_book_id: fx.books.fantasy,
        p_started_at: '2026-01-03T18:00:00+00:00',
        p_start_page: 0,
      },
      readingMutationResultSchema,
    );

    fantasyReadingId = started.reading.id;
    expect(started.reading.status).toBe('active');

    const p1Event = randomUUID();
    const progress = await expectRpcContract(
      fx.client,
      'record_progress',
      {
        p_event_id: p1Event,
        p_reading_id: fantasyReadingId,
        p_page: 120,
        p_occurred_at: '2026-01-04T20:00:00+00:00',
        p_local_date: '2026-01-04',
      },
      readingMutationResultSchema,
    );
    expect(progress.reading.currentPage).toBe(120);

    const duplicate = await expectRpcContract(
      fx.client,
      'record_progress',
      {
        p_event_id: p1Event,
        p_reading_id: fantasyReadingId,
        p_page: 120,
        p_occurred_at: '2026-01-04T20:00:00+00:00',
        p_local_date: '2026-01-04',
      },
      readingMutationResultSchema,
    );
    expect(duplicate.duplicate).toBe(true);

    const corrected = await expectRpcContract(
      fx.client,
      'correct_progress',
      {
        p_event_id: randomUUID(),
        p_reading_id: fantasyReadingId,
        p_page: 110,
        p_occurred_at: '2026-01-05T08:00:00+00:00',
        p_local_date: null,
      },
      readingMutationResultSchema,
    );
    expect(corrected.reading.currentPage).toBe(110);

    const paused = await expectRpcContract(
      fx.client,
      'pause_reading',
      { p_reading_id: fantasyReadingId },
      readingMutationResultSchema,
    );
    expect(paused.reading.status).toBe('paused');

    const resumed = await expectRpcContract(
      fx.client,
      'resume_reading',
      { p_reading_id: fantasyReadingId },
      readingMutationResultSchema,
    );
    expect(resumed.reading.status).toBe('active');

    const finished = await expectRpcContract(
      fx.client,
      'finish_reading',
      {
        p_event_id: randomUUID(),
        p_reading_id: fantasyReadingId,
        p_page: 662,
        p_occurred_at: '2026-01-18T21:00:00+00:00',
        p_local_date: '2026-01-18',
      },
      readingMutationResultSchema,
    );

    expect(finished.reading.status).toBe('completed');
    expect(finished.reading.endedAt).not.toBeNull();
  });

  it('save_review returns the complete review read model', async () => {
    const saved = await expectRpcContract(
      fx.client,
      'save_review',
      {
        p_book_id: fx.books.fantasy,
        p_rating: 4,
        p_adjectives: ['Epico', 'Malinconico', 'Immersivo'],
        p_scores: [
          { dimension_key: 'fantasy.worldbuilding', score: 5 },
          { dimension_key: 'fantasy.characters', score: 4 },
        ],
        p_tag_ids: [fx.tags.magic, fx.tags.friendship],
      },
      reviewSaveResultSchema,
    );

    expect(saved.review.rating).toBe(4);
    expect(saved.review.adjectives).toEqual(['Epico', 'Malinconico', 'Immersivo']);
    expect(saved.review.scores).toHaveLength(2);
  });

  it('get_book_detail returns the full aggregate', async () => {
    const detail = await expectRpcContract(
      fx.client,
      'get_book_detail',
      { p_book_id: fx.books.fantasy },
      bookDetailResponseSchema,
    );

    expect(detail.book.id).toBe(fx.books.fantasy);
    expect(detail.readings[0]?.sequence).toBe(1);
    expect(detail.review?.rating).toBe(4);
  });

  it('get_genre_view preserves read/unread sections', async () => {
    const genre = await expectRpcContract(
      fx.client,
      'get_genre_view',
      {
        p_genre_slug: 'fantasy-magical-gothic',
        p_sort_field: 'rating',
        p_sort_direction: 'desc',
        p_limit: 48,
        p_offset: 0,
      },
      genreViewResponseSchema,
    );

    expect(genre.sections[0].key).toBe('read');
    expect(genre.sections[0].books[0]?.id).toBe(fx.books.fantasy);
  });

  it('historical completed reading matches the same mutation contract', async () => {
    const result = await expectRpcContract(
      fx.client,
      'add_completed_reading',
      {
        p_book_id: fx.books.mythology,
        p_started_at: '2026-03-01T09:00:00+00:00',
        p_finished_at: '2026-03-10T20:00:00+00:00',
        p_final_page: 432,
        p_start_page: 10,
      },
      readingMutationResultSchema,
    );

    expect(result.reading.startPage).toBe(10);
    expect(result.reading.status).toBe('completed');
  });

  it('DNF is idempotent and appears in dashboard cemetery', async () => {
    // starting the queued thriller automatically removes it from the queue
    const started = await expectRpcContract(
      fx.client,
      'start_reading',
      {
        p_book_id: fx.books.thriller,
        p_started_at: '2026-04-01T18:00:00+00:00',
        p_start_page: 0,
      },
      readingMutationResultSchema,
    );

    const eventId = randomUUID();
    const dnf = await expectRpcContract(
      fx.client,
      'mark_dnf',
      {
        p_event_id: eventId,
        p_reading_id: started.reading.id,
        p_page: 58,
        p_occurred_at: '2026-04-03T19:00:00+00:00',
        p_local_date: '2026-04-03',
      },
      readingMutationResultSchema,
    );

    expect(dnf.reading.status).toBe('dnf');
  });

  it('calendar and annual statistics validate against their contracts', async () => {
    const calendar = await expectRpcContract(
      fx.client,
      'get_reading_calendar',
      { p_year: 2026 },
      readingCalendarResponseSchema,
    );
    expect(calendar.year).toBe(2026);

    const stats = await expectRpcContract(
      fx.client,
      'get_year_stats',
      { p_year: 2026 },
      yearStatsResponseSchema,
    );
    expect(stats.stats.booksFinished).toBeGreaterThanOrEqual(2);
  });

  it('explore pool contains only eligible unread books', async () => {
    const pool = await expectRpcContract(
      fx.client,
      'get_explore_pool',
      { p_genre_slugs: null },
      explorePoolResponseSchema,
    );

    expect(pool.books.every((book) => book.lifecycleState === 'unread')).toBe(true);
  });

  it('bingo read model and assignment mutation share one contract', async () => {
    const initial = await expectRpcContract(
      fx.client,
      'get_bingo_board',
      { p_year: 2026 },
      bingoBoardResponseSchema,
    );
    expect(initial.board.cells).toHaveLength(16);

    const assigned = await expectRpcContract(
      fx.client,
      'assign_bingo_book',
      {
        p_cell_id: fx.bingo.firstCellId,
        p_book_id: fx.books.fantasy,
      },
      bingoBoardResponseSchema,
    );

    expect(assigned.board.completedCount).toBe(1);
    expect(assigned.board.cells[0]?.book?.id).toBe(fx.books.fantasy);
  });

  it('genre change returns a BookSummary and reset signal', async () => {
    const changed = await expectRpcContract(
      fx.client,
      'change_book_genre',
      {
        p_book_id: fx.books.fantasy,
        p_genre_slug: 'mythology-epic-retelling',
      },
      genreChangeResponseSchema,
    );

    expect(changed.book.genre.slug).toBe('mythology-epic-retelling');
    expect(changed.reviewScoresReset).toBe(true);
  });

  it('stats dashboard returns nested v1 read models', async () => {
    await fx.sql`
      insert into public.quotes (user_id, user_book_id, body, page)
      values (
        ${fx.userId}::uuid,
        ${fx.books.fantasy}::uuid,
        'Una citazione di contract test.',
        48
      )
    `;

    const dashboard = await expectRpcContract(
      fx.client,
      'get_stats_dashboard',
      { p_year: 2026 },
      statsDashboardResponseSchema,
    );

    expect(dashboard.bingo?.totalCount).toBe(16);
    expect(dashboard.dnf.some((entry) => entry.book.id === fx.books.thriller)).toBe(true);
  });

  it('theme selection is a versioned RPC contract', async () => {
    const current = await expectRpcContract(
      fx.client,
      'get_theme_selection',
      undefined,
      themeMutationResponseSchema,
    );
    expect(current.selection).toEqual({ kind: 'builtin', key: 'segnalibro' });

    const changed = await expectRpcContract(
      fx.client,
      'set_theme_selection',
      {
        p_kind: 'builtin',
        p_key: 'segnalibro',
        p_custom_theme_id: null,
      },
      themeMutationResponseSchema,
    );
    expect(changed.selection).toEqual({ kind: 'builtin', key: 'segnalibro' });
  });
});
