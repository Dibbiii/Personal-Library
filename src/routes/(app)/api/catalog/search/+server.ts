import { json, type RequestHandler } from '@sveltejs/kit';
import { catalogSearchQuerySchema, catalogSearchResponseSchema } from '$lib/catalog/schemas';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/catalog/search?title=…&author=…&language=it -> fino a 80 candidati ordinati (Open Library + Google Books). */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const params = event.url.searchParams;
		const query = catalogSearchQuerySchema.parse({
			title: params.get('title') ?? '',
			...(params.get('author') ? { author: params.get('author') } : {}),
			...(params.get('language') ? { language: params.get('language') } : {}),
			...(params.has('sort') ? { sort: params.get('sort') } : {}),
			...(params.has('source') ? { source: params.get('source') } : {})
		});
		enforceRateLimit('search', userId);

		const result = await getCatalogRepository(event).searchDetailed(query);
		return json(catalogSearchResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
