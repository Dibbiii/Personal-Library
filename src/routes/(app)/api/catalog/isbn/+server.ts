import { json, type RequestHandler } from '@sveltejs/kit';
import { isbnLookupResponseSchema, isbnQuerySchema } from '$lib/catalog/schemas';
import { isbnLookupRequestSchema } from '$lib/contracts/rpc';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/catalog/isbn?isbn=9788804668039 -> edizione/i con quell'ISBN (`exactMatch` = preselezionabile). */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const { isbn } = isbnQuerySchema.parse({ isbn: event.url.searchParams.get('isbn') ?? '' });
		enforceRateLimit('search', userId);

		const request = isbnLookupRequestSchema.parse({ isbn });
		const result = await getCatalogRepository(event).lookupIsbnDetailed(request);
		return json(isbnLookupResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
