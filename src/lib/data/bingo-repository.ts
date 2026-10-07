import { z } from 'zod';
import { bingoBoardResponseSchema } from '../contracts/rpc';
import { bingoBoardListResponseSchema } from '../contracts/stats-lists';

import type { BingoRepository } from './repositories';
import type { RpcTransport } from './rpc-client';
import { callRpc } from './rpc-client';
import { RPC } from './rpc-names';

/** Bookish Bingo: card annuali da 16 caselle. `getBoard` lancia NOT_FOUND se l'anno non ha una card. */
export class RpcBingoRepository implements BingoRepository {
	constructor(private readonly transport: RpcTransport) {}

	async getBoard(year: number) {
		const response = await callRpc(
			this.transport,
			RPC.bingoBoard,
			{ p_year: year },
			bingoBoardResponseSchema
		);
		return response.board;
	}

	async assignBook(input: { cellId: string; bookId: string | null }) {
		const response = await callRpc(
			this.transport,
			RPC.bingoAssignBook,
			{ p_cell_id: input.cellId, p_book_id: input.bookId },
			bingoBoardResponseSchema
		);
		return response.board;
	}

	async listBoards() {
		return callRpc(this.transport, RPC.bingoListBoards, {}, bingoBoardListResponseSchema);
	}

	async createBoard(year: number) {
		const response = await callRpc(
			this.transport,
			RPC.bingoCreateBoard,
			{ p_year: year },
			bingoBoardResponseSchema
		);
		return response.board;
	}

	async updateBoard(input: { year: number; title: string; challenges: string[] }) {
		const response = await callRpc(
			this.transport,
			RPC.bingoUpdateBoard,
			{ p_year: input.year, p_title: input.title, p_challenges: input.challenges },
			bingoBoardResponseSchema
		);
		return response.board;
	}

	async deleteBoard(year: number) {
		await callRpc(
			this.transport,
			RPC.bingoDeleteBoard,
			{ p_year: year },
			z.object({ contractVersion: z.literal(1), ok: z.literal(true) })
		);
	}
}
