import { json, type RequestHandler } from '@sveltejs/kit';
import { bookInfoQuerySchema, bookInfoResponseSchema } from '$lib/catalog/book-info';
import { getBookInfoService } from '$lib/server/catalog';
import {
	enforceRateLimit,
	errorResponse,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

/** GET /api/catalog/info?title=…&author=…&language=it -> informazioni pubbliche (Open Library) o null. */
export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const params = event.url.searchParams;
		const query = bookInfoQuerySchema.parse({
			title: params.get('title') ?? '',
			author: params.get('author') ?? '',
			...(params.get('language') ? { language: params.get('language') } : {})
		});
		enforceRateLimit('search', userId);

		const info = await getBookInfoService()
			.get({ title: query.title, author: query.author, language: query.language ?? null })
			.catch(() => null);
		return json(bookInfoResponseSchema.parse({ info }), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
