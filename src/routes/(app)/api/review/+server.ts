import { json } from '@sveltejs/kit';
import { reviewSaveResultSchema } from '$lib/contracts/reviews';
import { resolveTagIds, saveReviewRequestSchema } from '$lib/review';
import { errorResponse, handle, parseBody } from './_http';
import type { RequestHandler } from './$types';

/**
 * Salva (crea o sostituisce) la recensione di un libro: voto, 3 aggettivi, rating per genere, tag.
 * I tag arrivano come slug e sono risolti in id dal server. Idempotente: la RPC riscrive lo stato.
 */
export const PUT: RequestHandler = (event) =>
	handle(event, 'review', async (review) => {
		const input = await parseBody(event.request, saveReviewRequestSchema);

		const reference = await review.getReference();
		const { ids, unknown } = resolveTagIds(input.tagSlugs, reference.tags);
		if (unknown.length) return errorResponse('VALIDATION', 'Tag non riconosciuto.');

		const result = await review.save({
			bookId: input.bookId,
			rating: input.rating,
			adjectives: input.adjectives,
			scores: input.scores,
			tagIds: ids
		});
		return json(reviewSaveResultSchema.parse(result));
	});
