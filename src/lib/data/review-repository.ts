import {
	quoteDeleteResponseSchema,
	quoteMutationResponseSchema,
	reviewReferenceResponseSchema,
	reviewSaveResultSchema,
	type AddQuoteInput,
	type UpdateQuoteInput
} from '../contracts/reviews';
import type { SaveReviewInput } from '../contracts/rpc';
import type { QuotesRepository, ReviewRepository } from './repositories';
import { callRpc, type RpcTransport } from './rpc-client';
import { RPC } from './rpc-names';

export class RpcReviewRepository implements ReviewRepository {
	constructor(private readonly transport: RpcTransport) {}

	async save(input: SaveReviewInput) {
		return callRpc(
			this.transport,
			RPC.saveReview,
			{
				p_book_id: input.bookId,
				p_rating: input.rating,
				p_adjectives: [...input.adjectives],
				p_scores: input.scores.map((s) => ({ dimension_key: s.dimensionKey, score: s.score })),
				p_tag_ids: input.tagIds
			},
			reviewSaveResultSchema
		);
	}

	async getReference() {
		return callRpc(this.transport, RPC.reviewReference, {}, reviewReferenceResponseSchema);
	}
}

export class RpcQuotesRepository implements QuotesRepository {
	constructor(private readonly transport: RpcTransport) {}

	async add(input: AddQuoteInput) {
		const result = await callRpc(
			this.transport,
			RPC.addQuote,
			{ p_book_id: input.bookId, p_body: input.body, p_page: input.page ?? null },
			quoteMutationResponseSchema
		);
		return result.quote;
	}

	async update(input: UpdateQuoteInput) {
		const result = await callRpc(
			this.transport,
			RPC.updateQuote,
			{ p_quote_id: input.quoteId, p_body: input.body, p_page: input.page ?? null },
			quoteMutationResponseSchema
		);
		return result.quote;
	}

	async remove(quoteId: string) {
		await callRpc(
			this.transport,
			RPC.deleteQuote,
			{ p_quote_id: quoteId },
			quoteDeleteResponseSchema
		);
	}
}
