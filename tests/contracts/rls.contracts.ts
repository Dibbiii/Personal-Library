// Registered by db.contracts.test.ts: row level security and the write-path hardening.
//
// "A" is a fully populated account (fixture), "B" an unrelated account. Everything B does
// below goes through the runtime role (segnalibro_app) exactly like the application.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	explorePoolResponseSchema,
	libraryHomeResponseSchema,
	readingMutationResultSchema,
	yearStatsResponseSchema
} from '../../src/lib/contracts';
import { createPgRpcClient, sql, withUser } from '../../src/lib/server/db';
import { runDb } from '../helpers/env';
import { createContractFixture, type ContractFixture } from '../helpers/fixture';
import { expectRpcContract, expectRpcError } from '../helpers/rpc';
import { createTestUser, type TestUser } from '../helpers/users';

const USER_TABLES = [
	'user_books',
	'readings',
	'reading_progress_events',
	'reviews',
	'review_scores',
	'user_book_tags',
	'quotes',
	'reading_queue',
	'bingo_boards',
	'bingo_cells',
	'custom_themes',
	'user_preferences'
] as const;

(runDb ? describe : describe.skip)('row level security', () => {
	let a: ContractFixture;
	let b: TestUser;
	let aReadingId: string;
	let aQuoteId: string;

	beforeAll(async () => {
		a = await createContractFixture();
		b = await createTestUser('rls');

		// Give A rows in every user-owned table so "B sees nothing" is meaningful.
		const started = await expectRpcContract(
			a.client,
			'start_reading',
			{ p_book_id: a.books.fantasy, p_started_at: '2026-01-03T18:00:00+00:00', p_start_page: 0 },
			readingMutationResultSchema
		);
		aReadingId = started.reading.id;
		await expectRpcContract(
			a.client,
			'record_progress',
			{
				p_event_id: randomUUID(),
				p_reading_id: aReadingId,
				p_page: 100,
				p_occurred_at: '2026-01-04T20:00:00+00:00',
				p_local_date: '2026-01-04'
			},
			readingMutationResultSchema
		);
		await expectRpcContract(
			a.client,
			'finish_reading',
			{
				p_event_id: randomUUID(),
				p_reading_id: aReadingId,
				p_page: 662,
				p_occurred_at: '2026-01-18T21:00:00+00:00',
				p_local_date: '2026-01-18'
			},
			readingMutationResultSchema
		);
		const review = await a.client.rpc('save_review', {
			p_book_id: a.books.fantasy,
			p_rating: 4,
			p_adjectives: ['Epico', 'Malinconico', 'Immersivo'],
			p_scores: [{ dimension_key: 'fantasy.worldbuilding', score: 5 }],
			p_tag_ids: [a.tags.magic]
		});
		expect(review.error).toBeNull();
		expect((await a.client.rpc('queue_add', { p_book_id: a.books.mythology, p_force: false })).error).toBeNull();

		aQuoteId = randomUUID();
		await a.sql`
			insert into public.quotes (id, user_id, user_book_id, body, page)
			values (${aQuoteId}::uuid, ${a.userId}::uuid, ${a.books.fantasy}::uuid, 'Segreta di A.', 10)
		`;
		await a.sql`
			insert into public.custom_themes (user_id, name, tokens)
			values (${a.userId}::uuid, 'Tema di A', '{"k":"v"}'::jsonb)
		`;
	});

	afterAll(async () => {
		await b?.cleanup();
		await a?.cleanup();
	});

	it('the owner sees their own rows in every table (sanity check for the tests below)', async () => {
		for (const table of USER_TABLES) {
			const [{ n }] = (await withUser(
				a.userId,
				(tx) => tx`select count(*)::int as n from ${tx(table)}`
			)) as unknown as [{ n: number }];
			expect(n, table).toBeGreaterThan(0);
		}
	});

	it('B sees an empty library through every read model', async () => {
		const home = await expectRpcContract(b.rpc, 'get_library_home', { p_shelf_limit: 24 }, libraryHomeResponseSchema);
		expect(home.currentlyReading).toEqual([]);
		expect(home.queue).toEqual([]);
		expect(home.shelves.every((shelf) => shelf.totalCount === 0 && shelf.books.length === 0)).toBe(true);

		const stats = await expectRpcContract(b.rpc, 'get_year_stats', { p_year: 2026 }, yearStatsResponseSchema);
		expect(stats.stats.booksFinished).toBe(0);
		expect(stats.stats.pagesRead).toBe(0);

		const pool = await expectRpcContract(b.rpc, 'get_explore_pool', { p_genre_slugs: null }, explorePoolResponseSchema);
		expect(pool.books).toEqual([]);
	});

	it("RPCs refuse to touch A's book, reading, cell, queue or review", async () => {
		const notFound = async (name: string, args: Record<string, unknown>) => {
			const err = await expectRpcError(b.rpc, name, args);
			expect(err.dataCode, `${name}: ${err.message}`).toBe('NOT_FOUND');
		};

		await notFound('get_book_detail', { p_book_id: a.books.fantasy });
		await notFound('start_reading', {
			p_book_id: a.books.fantasy,
			p_started_at: '2026-05-01T10:00:00+00:00',
			p_start_page: 0
		});
		await notFound('queue_add', { p_book_id: a.books.fantasy, p_force: false });
		// removing a book that is not in B's queue is a harmless no-op that reveals nothing
		const removed = await b.rpc.rpc('queue_remove', { p_book_id: a.books.mythology });
		expect(removed.error).toBeNull();
		expect((removed.data as { queue: unknown[] }).queue).toEqual([]);
		const aQueue = await a.sql`select 1 from public.reading_queue where user_id = ${a.userId}::uuid`;
		expect(aQueue).toHaveLength(1);
		await notFound('queue_move', { p_book_id: a.books.mythology, p_new_position: 1 });
		await notFound('change_book_genre', { p_book_id: a.books.fantasy, p_genre_slug: 'classics' });
		await notFound('assign_bingo_book', { p_cell_id: a.bingo.firstCellId, p_book_id: null });
		await notFound('get_bingo_board', { p_year: 2026 });
		await notFound('save_review', {
			p_book_id: a.books.fantasy,
			p_rating: 1,
			p_adjectives: ['a', 'b', 'c'],
			p_scores: [],
			p_tag_ids: []
		});
		await notFound('add_completed_reading', {
			p_book_id: a.books.fantasy,
			p_started_at: '2026-01-01T00:00:00+00:00',
			p_finished_at: '2026-01-02T00:00:00+00:00',
			p_final_page: 10
		});

		for (const name of ['pause_reading', 'resume_reading']) {
			const err = await expectRpcError(b.rpc, name, { p_reading_id: aReadingId });
			expect(err.dataCode, name).toBe('NOT_FOUND');
		}
		for (const name of ['record_progress', 'correct_progress', 'finish_reading', 'mark_dnf']) {
			const err = await expectRpcError(b.rpc, name, {
				p_event_id: randomUUID(),
				p_reading_id: aReadingId,
				p_page: 5,
				p_occurred_at: '2026-05-01T10:00:00+00:00',
				p_local_date: '2026-05-01'
			});
			expect(err.dataCode, name).toBe('NOT_FOUND');
		}

		// A's data is untouched
		const [book] = await a.sql<{ lifecycle_state: string; title: string }[]>`
			select lifecycle_state, title from public.user_books where id = ${a.books.fantasy}::uuid
		`;
		expect(book).toEqual({ lifecycle_state: 'finished', title: 'Il nome del vento' });
	});

	it('direct SELECT as B returns only B rows, also when asking for A by id', async () => {
		for (const table of USER_TABLES) {
			const rows = await withUser(b.id, (tx) => tx`select user_id from ${tx(table)}`);
			expect(
				rows.every((row) => row.user_id === b.id),
				table
			).toBe(true);

			const leaked = await withUser(
				b.id,
				(tx) => tx`select count(*)::int as n from ${tx(table)} where user_id = ${a.userId}::uuid`
			);
			expect(leaked[0]?.n, table).toBe(0);
		}

		const byId = await withUser(b.id, (tx) => tx`
			select
				(select count(*)::int from public.user_books where id = ${a.books.fantasy}::uuid) as books,
				(select count(*)::int from public.readings where id = ${aReadingId}::uuid) as readings,
				(select count(*)::int from public.quotes where id = ${aQuoteId}::uuid) as quotes,
				(select count(*)::int from public.bingo_cells where id = ${a.bingo.firstCellId}::uuid) as cells
		`);
		expect(byId[0]).toEqual({ books: 0, readings: 0, quotes: 0, cells: 0 });

		const profiles = await withUser(b.id, (tx) => tx`select id from public.profiles`);
		expect(profiles.map((p) => p.id)).toEqual([b.id]);
		const prefs = await withUser(b.id, (tx) => tx`select user_id from public.user_preferences`);
		expect(prefs.map((p) => p.user_id)).toEqual([b.id]); // created by the signup trigger
	});

	it('direct writes against A rows change nothing', async () => {
		const updated = await withUser(b.id, (tx) => tx`
			update public.user_books set title = 'hacked' where id = ${a.books.fantasy}::uuid returning id
		`);
		expect(updated).toHaveLength(0);

		const deleted = await withUser(b.id, (tx) => tx`
			delete from public.user_books where id = ${a.books.fantasy}::uuid returning id
		`);
		expect(deleted).toHaveLength(0);

		const quote = await withUser(b.id, (tx) => tx`
			update public.quotes set body = 'hacked' where id = ${aQuoteId}::uuid returning id
		`);
		expect(quote).toHaveLength(0);

		const profile = await withUser(b.id, (tx) => tx`
			update public.profiles set display_name = 'hacked' where id = ${a.userId}::uuid returning id
		`);
		expect(profile).toHaveLength(0);

		// inserting a row owned by A is rejected by the policy's WITH CHECK
		await expect(
			withUser(
				b.id,
				(tx) => tx`
					insert into public.user_books (id, user_id, genre_id, title, author_display, format)
					values (${randomUUID()}::uuid, ${a.userId}::uuid, 1, 'planted', 'x', 'physical')
				`
			)
		).rejects.toMatchObject({ code: '42501' });

		// a row owned by B pointing at A's book is rejected by the composite foreign key
		await expect(
			withUser(
				b.id,
				(tx) => tx`
					insert into public.quotes (user_id, user_book_id, body)
					values (${b.id}::uuid, ${a.books.fantasy}::uuid, 'cross-user')
				`
			)
		).rejects.toMatchObject({ code: '23503' });

		// B cannot re-assign a row to A by rewriting user_id on B's own data either
		const bBook = randomUUID();
		await withUser(b.id, (tx) => tx`
			insert into public.user_books (id, user_id, genre_id, title, author_display, format)
			values (${bBook}::uuid, ${b.id}::uuid, 1, 'Mio', 'x', 'physical')
		`);
		await expect(
			withUser(b.id, (tx) => tx`update public.user_books set user_id = ${a.userId}::uuid where id = ${bBook}::uuid`)
		).rejects.toMatchObject({ code: '42501' });

		const [row] = await a.sql<{ title: string; body: string; display_name: string }[]>`
			select
				(select title from public.user_books where id = ${a.books.fantasy}::uuid) as title,
				(select body from public.quotes where id = ${aQuoteId}::uuid) as body,
				(select display_name from public.profiles where id = ${a.userId}::uuid) as display_name
		`;
		expect(row).toEqual({ title: 'Il nome del vento', body: 'Segreta di A.', display_name: 'Contract fixture' });
	});

	it('projection columns and the event log cannot be written directly (write-path hardening)', async () => {
		await expect(
			withUser(a.userId, (tx) => tx`update public.user_books set lifecycle_state = 'finished' where id = ${a.books.romance}::uuid`)
		).rejects.toMatchObject({ code: '42501' });
		await expect(
			withUser(a.userId, (tx) => tx`update public.user_books set review_rating = 5 where id = ${a.books.romance}::uuid`)
		).rejects.toMatchObject({ code: '42501' });

		await expect(
			withUser(
				a.userId,
				(tx) => tx`
					insert into public.user_books (id, user_id, genre_id, title, author_display, format, lifecycle_state, completed_readings_count)
					values (${randomUUID()}::uuid, ${a.userId}::uuid, 1, 'Forged', 'x', 'physical', 'finished', 3)
				`
			)
		).rejects.toMatchObject({ code: '42501' });

		await withUser(a.userId, (tx) => tx`
			insert into public.user_books (id, user_id, genre_id, title, author_display, format, source)
			values (${randomUUID()}::uuid, ${a.userId}::uuid, 1, 'Libro inserito dal client', 'Autore', 'digital', 'manual')
		`);

		for (const statement of [
			(tx: typeof sql) => tx`insert into public.reading_progress_events (user_id, reading_id, event_type, page, local_date)
				values (${a.userId}::uuid, ${aReadingId}::uuid, 'progress', 1, '2026-05-01')`,
			(tx: typeof sql) => tx`update public.readings set current_page = 1 where id = ${aReadingId}::uuid`,
			(tx: typeof sql) => tx`delete from public.readings where id = ${aReadingId}::uuid`,
			(tx: typeof sql) => tx`insert into public.reading_queue (user_id, user_book_id, position) values (${a.userId}::uuid, ${a.books.thriller}::uuid, 9)`,
			(tx: typeof sql) => tx`delete from public.reviews where user_id = ${a.userId}::uuid`,
			(tx: typeof sql) => tx`insert into public.user_book_tags (user_id, user_book_id, tag_id) values (${a.userId}::uuid, ${a.books.thriller}::uuid, ${a.tags.magic})`
		]) {
			await expect(withUser(a.userId, (tx) => statement(tx as unknown as typeof sql))).rejects.toMatchObject({ code: '42501' });
		}
	});

	it('no identity means no data: anonymous SQL sees nothing and every RPC says AUTH_REQUIRED', async () => {
		for (const table of USER_TABLES) {
			const [{ n }] = (await sql`select count(*)::int as n from ${sql(table)}`) as unknown as [{ n: number }];
			expect(n, table).toBe(0);
		}
		const [{ n: profiles }] = (await sql`select count(*)::int as n from public.profiles`) as unknown as [{ n: number }];
		expect(profiles).toBe(0);

		await expect(
			sql`insert into public.user_books (user_id, genre_id, title, author_display, format)
				values (${a.userId}::uuid, 1, 'x', 'x', 'physical')`
		).rejects.toMatchObject({ code: '42501' });

		const anon = createPgRpcClient(null);
		for (const [name, args] of [
			['get_library_home', { p_shelf_limit: 24 }],
			['get_year_stats', { p_year: 2026 }],
			['queue_add', { p_book_id: a.books.fantasy, p_force: false }],
			['get_theme_selection', {}],
			['get_bingo_board', { p_year: 2026 }]
		] as const) {
			const err = await expectRpcError(anon, name, args);
			expect(err.dataCode, name).toBe('AUTH_REQUIRED');
			expect(err.code, name).toBe('42501');
		}
	});

	it('the identity lives only inside its transaction (no leakage across pooled connections)', async () => {
		await withUser(a.userId, async (tx) => {
			const [{ uid }] = (await tx`select app.current_user_id() as uid`) as unknown as [{ uid: string }];
			expect(uid).toBe(a.userId);
		});

		// 40 concurrent plain queries touch every pooled connection: none may still be "A".
		const leaks = await Promise.all(
			Array.from({ length: 40 }, () => sql`select app.current_user_id() as uid, (select count(*)::int from public.user_books) as n`)
		);
		for (const [row] of leaks) expect(row).toEqual({ uid: null, n: 0 });

		// rolled back transactions do not leave the setting behind either
		await expect(
			withUser(a.userId, async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
		const [{ uid }] = (await sql`select app.current_user_id() as uid`) as unknown as [{ uid: string | null }];
		expect(uid).toBeNull();

		await expect(withUser("x'; drop table user_books; --", async () => 1)).rejects.toThrow(TypeError);
	});
});
