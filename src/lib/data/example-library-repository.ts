import {
	bookDetailResponseSchema,
	genreViewResponseSchema,
	libraryHomeResponseSchema,
	shelfPageResponseSchema
} from '../contracts/rpc';

import type { ChangeBookFormatInput, ChangeBookGenreInput } from '../contracts/rpc';

import type { LibraryRepository } from './repositories';

import type { RpcTransport } from './rpc-client';

import { callRpc } from './rpc-client';
import { RPC } from './rpc-names';
import { bookFormatChangeResponseSchema, genreChangeResponseSchema } from '../contracts/rpc';
import { bookRemovalResultSchema } from '../contracts/library-mutations';

/**
 * Esempio reale dell'implementazione repository.
 *
 * Il repository riceve un RpcTransport (vedi src/lib/server/db, createPgRpcClient),
 * che chiama la funzione Postgres omonima e restituisce { data, error }.
 */
export class RpcLibraryRepository implements LibraryRepository {
	constructor(private readonly transport: RpcTransport) {}

	async getHome(options?: { shelfLimit?: number }) {
		return callRpc(
			this.transport,
			RPC.libraryHome,
			{
				p_shelf_limit: options?.shelfLimit ?? 24
			},
			libraryHomeResponseSchema
		);
	}

	async getShelfPage(input: Parameters<LibraryRepository['getShelfPage']>[0]) {
		return callRpc(
			this.transport,
			RPC.shelfPage,
			{
				p_genre_slug: input.genre,
				p_cursor_created_at: input.cursor?.createdAt ?? null,
				p_cursor_id: input.cursor?.id ?? null,
				p_limit: input.limit ?? 24
			},
			shelfPageResponseSchema
		);
	}

	async getGenreView(input: Parameters<LibraryRepository['getGenreView']>[0]) {
		return callRpc(
			this.transport,
			RPC.genreView,
			{
				p_genre_slug: input.genre,
				p_sort_field: input.sortField,
				p_sort_direction: input.direction,
				p_limit: input.limit ?? 48,
				p_offset: input.offset ?? 0
			},
			genreViewResponseSchema
		);
	}

	async getBookDetail(bookId: string) {
		return callRpc(this.transport, RPC.bookDetail, { p_book_id: bookId }, bookDetailResponseSchema);
	}

	async removeBook(bookId: string) {
		return callRpc(this.transport, RPC.removeBook, { p_book_id: bookId }, bookRemovalResultSchema);
	}

	async changeGenre(input: ChangeBookGenreInput) {
		const result = await callRpc(
			this.transport,
			RPC.changeBookGenre,
			{
				p_book_id: input.bookId,
				p_genre_slug: input.genreSlug
			},
			genreChangeResponseSchema
		);

		return {
			book: result.book,
			reviewScoresReset: result.reviewScoresReset
		};
	}

	async changeFormat(input: ChangeBookFormatInput) {
		const result = await callRpc(
			this.transport,
			RPC.changeBookFormat,
			{ p_book_id: input.bookId, p_format: input.format },
			bookFormatChangeResponseSchema
		);
		return result.book;
	}
}
