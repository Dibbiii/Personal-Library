import { runDb } from '../helpers/env';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	bookRemovalResponseSchema,
	bookRemovalResultSchema,
	removeBookRequestSchema
} from '../../src/lib/contracts/library-mutations';
import { createPgRpcClient } from '../../src/lib/server/db';
import { createContractFixture, type ContractFixture } from '../helpers/fixture';
import { expectRpcContract, expectRpcError } from '../helpers/rpc';
import { closeAdminSql, createTestUser, type TestUser } from '../helpers/users';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';
const READING_ID = '22222222-2222-4222-8222-222222222222';
const response = {
	contractVersion: 1,
	bookId: BOOK_ID,
	readingIds: [READING_ID],
	clearedBingoCells: 2
};

describe('library removal schemas (senza DB)', () => {
	it('accetta solo bookId e rifiuta un userId contraffatto', () => {
		expect(removeBookRequestSchema.parse({ bookId: BOOK_ID })).toEqual({ bookId: BOOK_ID });
		for (const input of [{}, { bookId: 'invalid' }, { bookId: BOOK_ID, userId: READING_ID }]) {
			expect(removeBookRequestSchema.safeParse(input).success).toBe(false);
		}
	});

	it('separa il risultato interno dalla risposta pubblica senza percorso cover', () => {
		for (const coverStoragePath of [null, `${BOOK_ID}/cover.webp`]) {
			const internal = bookRemovalResultSchema.parse({ ...response, coverStoragePath });
			expect(internal.coverStoragePath).toBe(coverStoragePath);
			expect(bookRemovalResponseSchema.parse(internal)).toEqual(response);
			expect(bookRemovalResponseSchema.parse(internal)).not.toHaveProperty('coverStoragePath');
		}
		expect(bookRemovalResultSchema.safeParse(response).success).toBe(false);
		expect(
			bookRemovalResponseSchema.parse({ ...response, readingIds: [], clearedBingoCells: 0 })
		).toMatchObject({ readingIds: [], clearedBingoCells: 0 });
	});

	it.each([
		{ contractVersion: 2 },
		{ bookId: 'invalid' },
		{ readingIds: ['invalid'] },
		{ readingIds: null },
		{ clearedBingoCells: -1 },
		{ clearedBingoCells: 0.5 },
		{ clearedBingoCells: '2' }
	])('rifiuta risultati fuori contratto: %j', (invalid) => {
		expect(bookRemovalResponseSchema.safeParse({ ...response, ...invalid }).success).toBe(false);
		expect(
			bookRemovalResultSchema.safeParse({ ...response, coverStoragePath: null, ...invalid }).success
		).toBe(false);
	});
});

const TABLES = [
	'public.user_books',
	'public.readings',
	'public.reading_progress_events',
	'public.reviews',
	'public.review_scores',
	'public.user_book_tags',
	'public.quotes',
	'public.reading_queue',
	'public.bingo_cells',
	'public.bingo_boards'
] as const;
type Row = Record<string, unknown>;
type Snapshot = Record<(typeof TABLES)[number], Row[]>;

async function snapshot(fx: ContractFixture, userId = fx.userId): Promise<Snapshot> {
	const result = {} as Snapshot;
	for (const table of TABLES) {
		const rows = await fx.sql<{ row: Row }[]>`
			select to_jsonb(t) as row from ${fx.sql(table)} t
			where user_id = ${userId}::uuid order by to_jsonb(t)::text
		`;
		result[table] = rows.map(({ row }) => row);
	}
	return result;
}

async function seedDependencies(fx: ContractFixture, bookId: string) {
	const readingIds: string[] = [randomUUID(), randomUUID()];
	const reviewId = randomUUID();
	await fx.sql`update public.user_books set genre_id = 5 where id = ${bookId}::uuid`;
	for (const readingId of readingIds) {
		await fx.sql`
			insert into public.readings (id, user_id, user_book_id, status, started_at, ended_at, current_page)
			values (${readingId}::uuid, ${fx.userId}::uuid, ${bookId}::uuid, 'completed',
				'2026-01-01T12:00:00Z', '2026-01-02T12:00:00Z', 100)
		`;
		await fx.sql`
			insert into public.reading_progress_events
				(user_id, reading_id, event_type, page, page_delta, local_date)
			values (${fx.userId}::uuid, ${readingId}::uuid, 'progress', 100, 100, '2026-01-02')
		`;
	}
	await fx.sql`
		insert into public.reviews (id, user_id, user_book_id, genre_id, rating, adjectives)
		values (${reviewId}::uuid, ${fx.userId}::uuid, ${bookId}::uuid, 5, 4,
			array['Epico', 'Immersivo', 'Malinconico'])
	`;
	await fx.sql`
		insert into public.review_scores (user_id, review_id, dimension_key, score)
		values (${fx.userId}::uuid, ${reviewId}::uuid, 'fantasy.worldbuilding', 5)
	`;
	await fx.sql`
		insert into public.user_book_tags (user_id, user_book_id, tag_id)
		values (${fx.userId}::uuid, ${bookId}::uuid, ${fx.tags.magic})
	`;
	await fx.sql`
		insert into public.quotes (user_id, user_book_id, body, page)
		values (${fx.userId}::uuid, ${bookId}::uuid, 'Una citazione da preservare o eliminare', 42)
	`;
	return { readingIds, reviewId };
}

// Nessun reset: tutte le mutazioni e gli snapshot sono limitati agli utenti della fixture.
(runDb ? describe : describe.skip)('remove_book RPC (migration 108)', () => {
	let fx: ContractFixture;
	let other: TestUser;
	let dependencies: Awaited<ReturnType<typeof seedDependencies>>;
	let coverStoragePath: string;

	beforeEach(async () => {
		fx = await createContractFixture();
		other = await createTestUser('library-removal-other');
		dependencies = await seedDependencies(fx, fx.books.fantasy);
		await seedDependencies(fx, fx.books.mythology);
		coverStoragePath = `covers/${fx.userId}/${fx.books.fantasy}.webp`;
		await fx.sql`update public.user_books set cover_storage_path = ${coverStoragePath}
			where id = ${fx.books.fantasy}::uuid`;
		for (const [index, bookId] of [
			fx.books.mythology,
			fx.books.fantasy,
			fx.books.thriller
		].entries()) {
			await fx.sql`insert into public.reading_queue (user_id, user_book_id, position)
				values (${fx.userId}::uuid, ${bookId}::uuid, ${index + 1})`;
		}
		await fx.sql`update public.bingo_cells
			set user_book_id = ${fx.books.fantasy}::uuid,
				completed_at = '2026-01-02T12:00:00Z'::timestamptz
			where board_id = ${fx.bingo.boardId}::uuid and position in (1, 2)`;
		await fx.sql`update public.bingo_cells
			set user_book_id = ${fx.books.mythology}::uuid, completed_at = '2026-01-02T12:00:00Z'
			where board_id = ${fx.bingo.boardId}::uuid and position = 3`;
		await fx.sql`insert into public.user_books
			(user_id, genre_id, title, author_display, page_count, language, format, source)
			values (${other.id}::uuid, 5, 'Il nome del vento', 'Patrick Rothfuss', 662, 'it', 'physical', 'manual')`;
	});

	afterEach(async () => {
		try {
			if (fx) await fx.cleanup();
		} finally {
			if (other) await other.cleanup();
		}
	});

	afterAll(closeAdminSql);

	it('elimina tutte le dipendenze del proprietario, preserva Bingo e compatta la coda', async () => {
		const before = await snapshot(fx);
		const foreignBefore = await snapshot(fx, other.id);
		const result = await expectRpcContract(
			fx.client,
			'remove_book',
			{ p_book_id: fx.books.fantasy },
			bookRemovalResultSchema
		);
		expect(result).toEqual({
			contractVersion: 1,
			bookId: fx.books.fantasy,
			readingIds: [...dependencies.readingIds].sort(),
			clearedBingoCells: 2,
			coverStoragePath
		});

		const after = await snapshot(fx);
		for (const table of TABLES.filter(
			(name) => !['public.reading_queue', 'public.bingo_cells'].includes(name)
		)) {
			const expected = before[table].filter(
				(row) =>
					row.id !== fx.books.fantasy &&
					row.user_book_id !== fx.books.fantasy &&
					!dependencies.readingIds.includes(String(row.id)) &&
					!dependencies.readingIds.includes(String(row.reading_id)) &&
					row.id !== dependencies.reviewId &&
					row.review_id !== dependencies.reviewId
			);
			expect(after[table], table).toEqual(expected);
		}
		for (const table of [
			'public.readings',
			'public.reading_progress_events',
			'public.reviews',
			'public.review_scores',
			'public.user_book_tags',
			'public.quotes'
		] as const) {
			expect(before[table].length, `${table}: fixture non vuota`).toBeGreaterThan(
				after[table].length
			);
			expect(
				after[table].length,
				`${table}: dipendenze dell'altro libro preservate`
			).toBeGreaterThan(0);
		}
		expect(after['public.bingo_boards']).toEqual(before['public.bingo_boards']);
		expect(after['public.bingo_cells']).toHaveLength(16);
		for (const cell of before['public.bingo_cells']) {
			const current = after['public.bingo_cells'].find((row) => row.id === cell.id);
			if (cell.user_book_id === fx.books.fantasy) {
				expect(current).toMatchObject({
					...cell,
					user_book_id: null,
					completed_at: null,
					updated_at: expect.any(String)
				});
			} else {
				expect(current).toEqual(cell);
			}
		}
		const queue = [...after['public.reading_queue']].sort(
			(a, b) => Number(a.position) - Number(b.position)
		);
		expect(queue.map((row) => [row.user_book_id, row.position])).toEqual([
			[fx.books.mythology, 1],
			[fx.books.thriller, 2]
		]);
		expect(await snapshot(fx, other.id)).toEqual(foreignBefore);
	});

	it('rifiuta altro utente e anonimo senza mutare libri, dipendenze, Bingo o coda', async () => {
		const before = await snapshot(fx);
		const foreignBefore = await snapshot(fx, other.id);
		for (const [client, code] of [
			[other.rpc, 'NOT_FOUND'],
			[createPgRpcClient(null), 'AUTH_REQUIRED']
		] as const) {
			expect(
				(await expectRpcError(client, 'remove_book', { p_book_id: fx.books.fantasy })).dataCode
			).toBe(code);
			expect(await snapshot(fx)).toEqual(before);
			expect(await snapshot(fx, other.id)).toEqual(foreignBefore);
		}
	});

	it('senza letture/cover/Bingo restituisce valori vuoti; la seconda rimozione è NOT_FOUND', async () => {
		const result = await expectRpcContract(
			fx.client,
			'remove_book',
			{ p_book_id: fx.books.classic },
			bookRemovalResultSchema
		);
		expect(result).toEqual({
			contractVersion: 1,
			bookId: fx.books.classic,
			readingIds: [],
			clearedBingoCells: 0,
			coverStoragePath: null
		});
		const after = await snapshot(fx);
		expect(
			(await expectRpcError(fx.client, 'remove_book', { p_book_id: fx.books.classic })).dataCode
		).toBe('NOT_FOUND');
		expect(await snapshot(fx)).toEqual(after);
	});
});
