import { explorePoolResponseSchema } from '../contracts/rpc';

import type { ExploreRepository } from './repositories';
import type { RpcTransport } from './rpc-client';
import { callRpc } from './rpc-client';
import { RPC } from './rpc-names';

/** Pool della Ruota della Fortuna: solo libri non letti (lifecycle `unread`). */
export class RpcExploreRepository implements ExploreRepository {
	constructor(private readonly transport: RpcTransport) {}

	async getPool(input?: Parameters<ExploreRepository['getPool']>[0]) {
		const genres = input?.genres;
		const response = await callRpc(
			this.transport,
			RPC.explorePool,
			{ p_genre_slugs: genres && genres.length > 0 ? genres : null },
			explorePoolResponseSchema
		);
		return response.books;
	}
}
