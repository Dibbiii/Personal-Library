import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { coverAlternativesResponseSchema } from '$lib/catalog/schemas';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/covers/alternatives?bookId=… -> cover dei provider per ISBN e titolo/autore di quel libro. */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const bookId = z.string().uuid().parse(event.url.searchParams.get('bookId'));
		enforceRateLimit('search', userId);

		const result = await getCatalogRepository(event).listCoverAlternatives(userId, bookId);
		return json(coverAlternativesResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
