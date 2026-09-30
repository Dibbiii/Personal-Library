import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bingoBoardListResponseSchema,
	bingoBoardResponseSchema,
	completedBooksResponseSchema,
	quoteListResponseSchema,
	yearGenreBreakdownResponseSchema
} from '../../src/lib/contracts';
import { runDb } from '../helpers/env'; // first: sets DATABASE_URL defaults
import { createContractFixture, type ContractFixture } from '../helpers/fixture';
import { expectRpcContract, expectRpcError } from '../helpers/rpc';
import { closeAdminSql, createTestUser, type TestUser } from '../helpers/users';

describe('contratti delle liste Statistiche/Bingo/Citazioni (Zod, senza DB)', () => {
	it('accetta le forme restituite da list_quotes, list_bingo_boards e get_year_genre_breakdown', () => {
		const genre = { id: 5, slug: 'fantasy-magical-gothic', name: 'Fantasy' };
		expect(
			quoteListResponseSchema.parse({
				contractVersion: 1,
				total: 1,
				quotes: [
					{
						id: '11111111-1111-4111-8111-111111111111',
						userBookId: '22222222-2222-4222-8222-222222222222',
						body: 'Una frase',
						page: 48,
						createdAt: '2026-03-01T10:00:00+00:00',
						updatedAt: '2026-03-01T10:00:00+00:00',
						bookTitle: 'Il nome del vento',
						author: 'Patrick Rothfuss',
						genre
					}
				]
			}).quotes
		).toHaveLength(1);

		const board = bingoBoardListResponseSchema.parse({
			contractVersion: 1,
			boards: [
				{
					boardId: '33333333-3333-4333-8333-333333333333',
					year: 2026,
					title: 'La card del 2026',
					completedCount: 2,
					totalCount: 16,
					completedPositions: [1, 3]
				}
			]
		});
		expect(board.boards[0]?.completedPositions).toEqual([1, 3]);

		expect(
			yearGenreBreakdownResponseSchema.parse({
				contractVersion: 1,
				year: 2026,
				genres: [{ genre, booksFinished: 7 }]
			}).genres
		).toHaveLength(1);
		expect(completedBooksResponseSchema.parse({ contractVersion: 1, books: [] }).books).toEqual([]);
	});

	it('rifiuta posizioni fuori da 1..16 e versioni diverse', () => {
		expect(() =>
			bingoBoardListResponseSchema.parse({
				contractVersion: 1,
				boards: [
					{
						boardId: '33333333-3333-4333-8333-333333333333',
						year: 2026,
						title: null,
						completedCount: 1,
						totalCount: 16,
						completedPositions: [17]
					}
				]
			})
		).toThrow();
		expect(() => quoteListResponseSchema.parse({ contractVersion: 2, total: 0, quotes: [] })).toThrow();
	});
});

(runDb ? describe : describe.skip)('RPC 105: liste, nuova card Bingo, libri letti', () => {
	let fx: ContractFixture;
	let other: TestUser;

	beforeAll(async () => {
		fx = await createContractFixture();
		other = await createTestUser('lists-other');
	});

	afterAll(async () => {
		await fx?.cleanup();
		await other?.cleanup();
		await closeAdminSql();
	});

	it('list_bingo_boards restituisce le card con le posizioni completate', async () => {
		const empty = await expectRpcContract(other.rpc, 'list_bingo_boards', {}, bingoBoardListResponseSchema);
		expect(empty.boards).toEqual([]);

		const mine = await expectRpcContract(fx.client, 'list_bingo_boards', {}, bingoBoardListResponseSchema);
		expect(mine.boards.map((board) => board.year)).toEqual([2026]);
		expect(mine.boards[0]).toMatchObject({ completedCount: 0, completedPositions: [] });
	});

	it('create_bingo_board crea 16 caselle di default, una sola volta per anno', async () => {
		const created = await expectRpcContract(
			other.rpc,
			'create_bingo_board',
			{ p_year: 2031 },
			bingoBoardResponseSchema
		);
		expect(created.board).toMatchObject({ year: 2031, title: 'La card del 2031', completedCount: 0 });
		expect(created.board.cells.map((cell) => cell.position)).toEqual(
			Array.from({ length: 16 }, (_, i) => i + 1)
		);
		expect(created.board.cells[0]?.challenge).toBe('Oltre 500 pagine');
		expect(created.board.cells[15]?.challenge).toBe('Libro da BookTok');

		const again = await expectRpcError(other.rpc, 'create_bingo_board', { p_year: 2031 });
		expect(again.dataCode).toBe('CONFLICT');

		const invalid = await expectRpcError(other.rpc, 'create_bingo_board', { p_year: 1800 });
		expect(invalid.dataCode).toBe('VALIDATION');

		// La card di un utente non compare all'altro.
		const mine = await expectRpcContract(fx.client, 'list_bingo_boards', {}, bingoBoardListResponseSchema);
		expect(mine.boards.map((board) => board.year)).not.toContain(2031);
	});

	it('list_completed_books include solo libri con una lettura completata e filtra per testo', async () => {
		const before = await expectRpcContract(
			fx.client,
			'list_completed_books',
			{ p_query: null, p_limit: 50 },
			completedBooksResponseSchema
		);
		expect(before.books).toEqual([]);

		await fx.client.rpc('add_completed_reading', {
			p_book_id: fx.books.mythology,
			p_started_at: '2026-03-01T09:00:00+00:00',
			p_finished_at: '2026-03-10T20:00:00+00:00',
			p_final_page: 432,
			p_start_page: 0
		});

		const all = await expectRpcContract(
			fx.client,
			'list_completed_books',
			{ p_query: null, p_limit: 50 },
			completedBooksResponseSchema
		);
		expect(all.books.map((book) => book.title)).toEqual(['Circe']);

		const byAuthor = await expectRpcContract(
			fx.client,
			'list_completed_books',
			{ p_query: 'miller', p_limit: 50 },
			completedBooksResponseSchema
		);
		expect(byAuthor.books).toHaveLength(1);

		const none = await expectRpcContract(
			fx.client,
			'list_completed_books',
			{ p_query: '100%', p_limit: 50 },
			completedBooksResponseSchema
		);
		expect(none.books).toEqual([]);

		const isolated = await expectRpcContract(
			other.rpc,
			'list_completed_books',
			{ p_query: null, p_limit: 50 },
			completedBooksResponseSchema
		);
		expect(isolated.books).toEqual([]);
	});

	it('assegnare un libro non letto è rifiutato, uno letto aggiorna la lista delle card', async () => {
		const unread = await expectRpcError(fx.client, 'assign_bingo_book', {
			p_cell_id: fx.bingo.firstCellId,
			p_book_id: fx.books.romance
		});
		expect(unread.dataCode).toBe('CONFLICT');

		const assigned = await expectRpcContract(
			fx.client,
			'assign_bingo_book',
			{ p_cell_id: fx.bingo.firstCellId, p_book_id: fx.books.mythology },
			bingoBoardResponseSchema
		);
		expect(assigned.board.completedCount).toBe(1);

		const list = await expectRpcContract(fx.client, 'list_bingo_boards', {}, bingoBoardListResponseSchema);
		expect(list.boards[0]).toMatchObject({ completedCount: 1, completedPositions: [1] });

		const cleared = await expectRpcContract(
			fx.client,
			'assign_bingo_book',
			{ p_cell_id: fx.bingo.firstCellId, p_book_id: null },
			bingoBoardResponseSchema
		);
		expect(cleared.board.completedCount).toBe(0);
	});

	it('list_quotes elenca le citazioni dell’utente con libro, autore e genere', async () => {
		await fx.sql`
			insert into public.quotes (user_id, user_book_id, body, page)
			values
				(${fx.userId}::uuid, ${fx.books.mythology}::uuid, 'Prima citazione', 10),
				(${fx.userId}::uuid, ${fx.books.fantasy}::uuid, 'Seconda citazione', null)
		`;

		const all = await expectRpcContract(
			fx.client,
			'list_quotes',
			{ p_book_id: null, p_limit: 100, p_offset: 0 },
			quoteListResponseSchema
		);
		expect(all.total).toBe(2);
		expect(all.quotes.map((quote) => quote.body).sort()).toEqual(['Prima citazione', 'Seconda citazione']);
		const first = all.quotes.find((quote) => quote.body === 'Prima citazione');
		expect(first).toMatchObject({ bookTitle: 'Circe', author: 'Madeline Miller', page: 10 });
		expect(first?.genre.slug).toBe('mythology-epic-retelling');

		const filtered = await expectRpcContract(
			fx.client,
			'list_quotes',
			{ p_book_id: fx.books.fantasy, p_limit: 100, p_offset: 0 },
			quoteListResponseSchema
		);
		expect(filtered.total).toBe(1);

		const paged = await expectRpcContract(
			fx.client,
			'list_quotes',
			{ p_book_id: null, p_limit: 1, p_offset: 1 },
			quoteListResponseSchema
		);
		expect(paged.quotes).toHaveLength(1);
		expect(paged.total).toBe(2);

		const isolated = await expectRpcContract(
			other.rpc,
			'list_quotes',
			{ p_book_id: null, p_limit: 100, p_offset: 0 },
			quoteListResponseSchema
		);
		expect(isolated).toMatchObject({ total: 0, quotes: [] });
	});

	it('get_year_genre_breakdown somma alle letture completate dell’anno e coincide con topGenre', async () => {
		const breakdown = await expectRpcContract(
			fx.client,
			'get_year_genre_breakdown',
			{ p_year: 2026 },
			yearGenreBreakdownResponseSchema
		);
		expect(breakdown.genres).toEqual([
			expect.objectContaining({
				booksFinished: 1,
				genre: expect.objectContaining({ slug: 'mythology-epic-retelling' })
			})
		]);

		const empty = await expectRpcContract(
			fx.client,
			'get_year_genre_breakdown',
			{ p_year: 2019 },
			yearGenreBreakdownResponseSchema
		);
		expect(empty.genres).toEqual([]);
	});
});
