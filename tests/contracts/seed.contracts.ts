// Registered by db.contracts.test.ts so that `npm run test:contracts:db` runs it too.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bingoBoardResponseSchema,
	explorePoolResponseSchema,
	genreViewResponseSchema,
	libraryHomeResponseSchema,
	readingCalendarResponseSchema,
	statsDashboardResponseSchema,
	yearStatsResponseSchema
} from '../../src/lib/contracts';
import { authenticate, createSession, invalidateSession, validateSession } from '../../src/lib/server/auth';
import { createPgRpcClient } from '../../src/lib/server/db';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import { runDb } from '../helpers/env';
import { expectRpcContract } from '../helpers/rpc';

/**
 * Validates the development seed (db/seed/demo_library.sql via scripts/db-seed.mjs,
 * demo@segnalibro.local) against the same Zod contracts used by the app, and pins the
 * numbers that the approved mockups show. Skipped automatically when the database was
 * reset without the demo seed.
 *
 * Only `currentStreak` depends on the wall clock (seed activity ends on 2026-09-29).
 */
const DEMO = { email: 'demo@segnalibro.local', password: 'segnalibro-demo' };

(runDb ? describe : describe.skip)('Demo seed matches the mockups', () => {
	let client: RpcTransport;
	let seeded = false;
	let token: string | undefined;

	beforeAll(async () => {
		const user = await authenticate(DEMO.email, DEMO.password);
		seeded = user !== null;
		if (user) {
			client = createPgRpcClient(user.id);
			token = (await createSession(user.id)).token;
		}
	});

	afterAll(async () => {
		if (token) await invalidateSession(token);
	});

	it('the demo account can log in and open a session', async (ctx) => {
		if (!seeded) return ctx.skip();
		expect(await validateSession(token!)).toMatchObject({
			email: DEMO.email,
			displayName: 'Alessandra'
		});
	});

	it('Home: two current readings, three queued books, eight shelves', async (ctx) => {
		if (!seeded) return ctx.skip();
		const home = await expectRpcContract(
			client,
			'get_library_home',
			{ p_shelf_limit: 24 },
			libraryHomeResponseSchema
		);

		expect(home.currentlyReading.map((r) => [r.book.title, r.reading.currentPage])).toEqual([
			['Dune', 214],
			['Le otto montagne', 164]
		]);
		expect(home.currentlyReading.map((r) => Math.round(r.reading.progressPercent ?? 0))).toEqual([
			30, 62
		]);
		expect(home.queue.map((q) => q.book.title)).toEqual([
			'Circe',
			'Il problema dei tre corpi',
			"Assassinio sull'Orient Express"
		]);
		expect(home.shelves).toHaveLength(8);
		const myth = home.shelves.find((s) => s.genre.slug === 'mythology-epic-retelling');
		expect(myth?.totalCount).toBe(9);
	});

	it('Genre view Mitologia: 6 read + 3 to read, ordered by rating', async (ctx) => {
		if (!seeded) return ctx.skip();
		const view = await expectRpcContract(
			client,
			'get_genre_view',
			{
				p_genre_slug: 'mythology-epic-retelling',
				p_sort_field: 'rating',
				p_sort_direction: 'desc',
				p_limit: 48,
				p_offset: 0
			},
			genreViewResponseSchema
		);
		expect(view.counts).toEqual({ total: 9, read: 6, unread: 3 });
		expect(view.sections[0]?.books.map((b) => [b.title, b.reviewRating])).toEqual([
			['La canzone di Achille', 5],
			['Odissea', 5],
			['Il silenzio delle ragazze', 4],
			['Il canto di Penelope', 4],
			['Norse Mythology', 4],
			['Lavinia', 3]
		]);
		expect(view.sections[1]?.books.map((b) => b.title)).toEqual(['Circe', 'Medea. Voci', 'Iliade']);
	});

	it('Statistics 2026: pages, streaks, golden month, tags, Bingo, DNF, quotes', async (ctx) => {
		if (!seeded) return ctx.skip();
		const stats = await expectRpcContract(
			client,
			'get_year_stats',
			{ p_year: 2026 },
			yearStatsResponseSchema
		);
		expect(stats.stats.pagesRead).toBe(18420);
		expect(stats.stats.recordStreak).toBe(41);
		expect(stats.stats.goldenMonth).toEqual({ month: 3, booksFinished: 9 });
		expect(stats.stats.topGenre?.genre.slug).toBe('mythology-epic-retelling');
		expect(stats.stats.topAuthor?.name).toBe('Madeline Miller');
		expect(stats.stats.topTags.slice(0, 4).map((t) => [t.label, t.count])).toEqual([
			['Friends to lovers', 12],
			['Magia', 9],
			['Doppia linea temporale', 7],
			['Character development', 6]
		]);

		const dashboard = await expectRpcContract(
			client,
			'get_stats_dashboard',
			{ p_year: 2026 },
			statsDashboardResponseSchema
		);
		expect(dashboard.bingo).toMatchObject({ completedCount: 7, totalCount: 16 });
		expect(dashboard.dnf.map((d) => [d.book.title, d.stoppedAtPage])).toEqual([
			['Ulisse', 112],
			['Moby Dick', 204],
			['Il Silmarillion', 58]
		]);
		expect(dashboard.quotePreviews.map((q) => q.page)).toEqual([48, 131]);
	});

	it('Calendar and Bingo boards (2026: 7/16, 2025: 16/16, 2024: 11/16)', async (ctx) => {
		if (!seeded) return ctx.skip();
		const calendar = await expectRpcContract(
			client,
			'get_reading_calendar',
			{ p_year: 2026 },
			readingCalendarResponseSchema
		);
		expect(calendar.days.length).toBeGreaterThan(200);
		expect(calendar.days.some((day) => day.genres.length > 1)).toBe(true);

		for (const [year, count] of [
			[2026, 7],
			[2025, 16],
			[2024, 11]
		] as const) {
			const board = await expectRpcContract(
				client,
				'get_bingo_board',
				{ p_year: year },
				bingoBoardResponseSchema
			);
			expect(board.board.completedCount).toBe(count);
		}
	});

	it('Explore pool only contains unread books (wheel of fortune)', async (ctx) => {
		if (!seeded) return ctx.skip();
		const pool = await expectRpcContract(
			client,
			'get_explore_pool',
			{ p_genre_slugs: null },
			explorePoolResponseSchema
		);
		const titles = pool.books.map((b) => b.title);
		for (const expected of ['Rebecca', 'Fahrenheit 451', 'Circe', 'Medea. Voci']) {
			expect(titles).toContain(expected);
		}
		expect(titles).not.toContain('Dune');
	});
});
