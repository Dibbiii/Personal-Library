import type { QueueBook } from '../contracts/books';
import { queueAddResponseSchema, queueMutationResponseSchema } from '../contracts/rpc';
import type { QueueMoveInput } from '../contracts/rpc';
import type { QueueRepository } from './repositories';
import type { RpcTransport } from './rpc-client';
import { callRpc } from './rpc-client';
import { RPC } from './rpc-names';

/** Coda "I prossimi" (RPC `queue_add` / `queue_remove` / `queue_move`). */
export class RpcQueueRepository implements QueueRepository {
	constructor(private readonly transport: RpcTransport) {}

	add(bookId: string, options?: { force?: boolean }) {
		return callRpc(
			this.transport,
			RPC.queueAdd,
			{ p_book_id: bookId, p_force: options?.force ?? false },
			queueAddResponseSchema
		);
	}

	async remove(bookId: string): Promise<QueueBook[]> {
		const result = await callRpc(
			this.transport,
			RPC.queueRemove,
			{ p_book_id: bookId },
			queueMutationResponseSchema
		);
		return result.queue;
	}

	async move(input: QueueMoveInput): Promise<QueueBook[]> {
		const result = await callRpc(
			this.transport,
			RPC.queueMove,
			{ p_book_id: input.bookId, p_new_position: input.newPosition },
			queueMutationResponseSchema
		);
		return result.queue;
	}
}
