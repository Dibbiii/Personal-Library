import {
	completedBooksResponseSchema,
	quoteListResponseSchema,
	yearGenreBreakdownResponseSchema
} from '../contracts/stats-lists';

import type { StatsExtrasRepository } from './repositories';
import type { RpcTransport } from './rpc-client';
import { callRpc } from './rpc-client';
import { RPC } from './rpc-names';

/** Elenco globale delle citazioni e ripartizione per genere dell'anno (barra di Statistiche). */
export class RpcStatsExtrasRepository implements StatsExtrasRepository {
	constructor(private readonly transport: RpcTransport) {}

	async listQuotes(input?: { bookId?: string; limit?: number; offset?: number }) {
		return callRpc(
			this.transport,
			RPC.listQuotes,
			{
				p_book_id: input?.bookId ?? null,
				p_limit: input?.limit ?? 100,
				p_offset: input?.offset ?? 0
			},
			quoteListResponseSchema
		);
	}

	async getGenreBreakdown(year: number) {
		return callRpc(
			this.transport,
			RPC.yearGenreBreakdown,
			{ p_year: year },
			yearGenreBreakdownResponseSchema
		);
	}

	async listCompletedBooks(input?: { query?: string; limit?: number }) {
		return callRpc(
			this.transport,
			RPC.listCompletedBooks,
			{ p_query: input?.query ?? null, p_limit: input?.limit ?? 50 },
			completedBooksResponseSchema
		);
	}
}
