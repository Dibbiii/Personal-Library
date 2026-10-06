import { json, type RequestHandler } from '@sveltejs/kit';
import { discoverQuerySchema, discoverResponseSchema } from '$lib/catalog/discover';
import { getDiscoverService } from '$lib/server/catalog';
import {
	enforceRateLimit,
	errorResponse,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/discover?section=…&q=…&topics=a,b&minRating=4&from=…&to=…&lang=it&cover=1&sort=…&page=1 */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const query = discoverQuerySchema.parse(Object.fromEntries(event.url.searchParams));
		enforceRateLimit('discover', userId);
		const result = await getDiscoverService().list(query);
		return json(discoverResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
