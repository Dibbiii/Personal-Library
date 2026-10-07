import { randomUUID } from 'node:crypto';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import { adminSql, createTestUser, type TestUser } from './users';

export interface ContractFixture {
	user: TestUser;
	userId: string;
	/** RPC transport bound to the fixture user. */
	client: RpcTransport;
	/** Owner-role connection (RLS bypass) for arranging / inspecting data. */
	sql: ReturnType<typeof adminSql>;
	books: {
		fantasy: string;
		mythology: string;
		thriller: string;
		classic: string;
		romance: string;
	};
	bingo: {
		boardId: string;
		firstCellId: string;
	};
	tags: {
		magic: number;
		romantico: number;
	};
	cleanup(): Promise<void>;
}

/**
 * A fresh account with five books (one linked to a catalog edition), a complete
 * 2026 Bingo board and the tag/dimension reference data the review test needs.
 */
export async function createContractFixture(): Promise<ContractFixture> {
	const sql = adminSql();
	const user = await createTestUser('fixture');
	const userId = user.id;
	const suffix = randomUUID().slice(0, 8);

	// Rating dimensions come from migration 004; insert-if-missing only, so the
	// suite never rewrites (e.g. re-sorts) the shared reference data.
	await sql`
		insert into public.rating_dimensions (
			dimension_key, genre_id, label_it, sort_order, version, is_active
		) values
			('fantasy.worldbuilding', 5, 'Worldbuilding', 1, 1, true),
			('fantasy.characters',    5, 'Personaggi',    2, 1, true)
		on conflict (dimension_key) do nothing
	`;

	const tagId = async (slug: string, label: string, order: number) => {
		await sql`
			insert into public.tags (slug, label_it, sort_order, is_active)
			values (${slug}, ${label}, ${order}, true)
			on conflict (slug) do nothing
		`;
		const [row] = await sql<{ id: number }[]>`select id from public.tags where slug = ${slug}`;
		if (!row) throw new Error(`Unable to seed tag ${slug}`);
		return row.id;
	};
	const magic = await tagId('magic', 'Magia', 9);
	const romantico = await tagId('romantico', 'Romantico', 1);

	const workSuffix = `contract-${suffix}`;
	const [work] = await sql<{ id: string }[]>`
		insert into public.works (title, original_title, first_published_year, open_library_work_id)
		values ('Il nome del vento', 'The Name of the Wind', 2007, ${`OL-${workSuffix}`})
		returning id::text
	`;
	if (!work) throw new Error('Unable to seed work');

	const [author] = await sql<{ id: string }[]>`
		insert into public.authors (name, open_library_author_id)
		values ('Patrick Rothfuss', ${`OLA-${workSuffix}`})
		returning id::text
	`;
	if (!author) throw new Error('Unable to seed author');

	await sql`
		insert into public.work_authors (work_id, author_id, position)
		values (${work.id}::bigint, ${author.id}::bigint, 1)
	`;

	const [edition] = await sql<{ id: string }[]>`
		insert into public.editions (
			work_id, isbn_13, language, publisher, published_year,
			page_count, cover_provider, cover_url
		) values (
			${work.id}::bigint,
			${`978${suffix.replace(/[^0-9]/g, '').padEnd(10, '0').slice(0, 10)}`}::text,
			'it', 'Contract Press', 2026,
			662, 'open-library', 'https://covers.openlibrary.org/b/id/12345-L.jpg'
		)
		returning id::text
	`;
	if (!edition) throw new Error('Unable to seed edition');

	const books = {
		fantasy: randomUUID(),
		mythology: randomUUID(),
		thriller: randomUUID(),
		classic: randomUUID(),
		romance: randomUUID()
	};

	await sql`
		insert into public.user_books (
			id, user_id, edition_id, genre_id, title, author_display, page_count,
			language, format, source, series_name, series_number, series_total,
			cover_url
		) values
			(
				${books.fantasy}::uuid, ${userId}::uuid, ${edition.id}::bigint, 5,
				'Il nome del vento', 'Patrick Rothfuss', 662, 'it', 'physical', 'search',
				'Le Cronache dell''Assassino del Re', 1, 3,
				'https://covers.openlibrary.org/b/id/12345-L.jpg'
			),
			(
				${books.mythology}::uuid, ${userId}::uuid, null, 2,
				'Circe', 'Madeline Miller', 432, 'it', 'physical', 'manual',
				null, null, null,
				'https://covers.openlibrary.org/b/id/23456-L.jpg'
			),
			(
				${books.thriller}::uuid, ${userId}::uuid, null, 4,
				'Assassinio sull''Orient Express', 'Agatha Christie', 256, 'it', 'digital', 'manual',
				null, null, null,
				'https://covers.openlibrary.org/b/id/34567-L.jpg'
			),
			(
				${books.classic}::uuid, ${userId}::uuid, null, 1,
				'Orgoglio e pregiudizio', 'Jane Austen', 432, 'it', 'physical', 'manual',
				null, null, null,
				'https://covers.openlibrary.org/b/id/45678-L.jpg'
			),
			(
				${books.romance}::uuid, ${userId}::uuid, null, 6,
				'Red, White & Royal Blue', 'Casey McQuiston', 448, 'en', 'digital', 'manual',
				null, null, null,
				'https://covers.openlibrary.org/b/id/56789-L.jpg'
			)
	`;

	const boardId = randomUUID();
	await sql`
		insert into public.bingo_boards (id, user_id, year, title)
		values (${boardId}::uuid, ${userId}::uuid, 2026, 'La card del 2026')
	`;

	const cells = Array.from({ length: 16 }, (_, index) => ({
		id: randomUUID(),
		position: index + 1,
		challenge: `Sfida ${index + 1}`
	}));

	for (const cell of cells) {
		await sql`
			insert into public.bingo_cells (id, user_id, board_id, position, challenge)
			values (${cell.id}::uuid, ${userId}::uuid, ${boardId}::uuid, ${cell.position}, ${cell.challenge})
		`;
	}

	return {
		user,
		userId,
		client: user.rpc,
		sql,
		books,
		bingo: { boardId, firstCellId: cells[0]!.id },
		tags: { magic, romantico },
		async cleanup() {
			// Also exercises "delete account": the user owns a book assigned to a
			// Bingo cell, which must not block the cascade (migration 005).
			await sql`delete from app.users where id = ${userId}::uuid`;
		}
	};
}
