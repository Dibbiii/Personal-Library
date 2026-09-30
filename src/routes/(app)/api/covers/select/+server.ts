import { json, type RequestHandler } from '@sveltejs/kit';
import { coverChangedResponseSchema, coverSelectRequestSchema } from '$lib/catalog/schemas';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	readJsonBody,
	requireUserId
} from '$lib/server/catalog/api';

/**
 * POST /api/covers/select (JSON)
 *  - { action: 'provider', bookId, coverUrl }  usa una cover di un provider (host in allow-list)
 *  - { action: 'remove-custom', bookId }       toglie la cover personalizzata
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const input = coverSelectRequestSchema.parse(await readJsonBody(event.request));
		enforceRateLimit('cover', userId);

		const catalog = getCatalogRepository(event);
		const state =
			input.action === 'provider'
				? await catalog.selectProviderCover(userId, input.bookId, input.coverUrl)
				: await catalog.removeCustomCover(userId, input.bookId);
		return json(coverChangedResponseSchema.parse(state), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
