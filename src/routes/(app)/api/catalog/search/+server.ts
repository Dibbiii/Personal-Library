import { json, type RequestHandler } from '@sveltejs/kit';
import { catalogSearchQuerySchema, catalogSearchResponseSchema } from '$lib/catalog/schemas';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/catalog/search?title=…&author=…&language=it -> migliori 3-5 candidati (Open Library + Google Books). */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const params = event.url.searchParams;
		const query = catalogSearchQuerySchema.parse({
			title: params.get('title') ?? '',
			...(params.get('author') ? { author: params.get('author') } : {}),
			...(params.get('language') ? { language: params.get('language') } : {})
		});
		enforceRateLimit('search', userId);

		const result = await getCatalogRepository(event).searchDetailed(query);
		return json(catalogSearchResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
