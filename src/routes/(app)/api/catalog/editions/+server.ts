import { json, type RequestHandler } from '@sveltejs/kit';
import { editionsQuerySchema, editionsResponseSchema } from '$lib/catalog/editions';
import { editionsService } from '$lib/server/catalog/editions';
import {
	enforceRateLimit,
	errorResponse,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const query = editionsQuerySchema.parse({
			workId: event.url.searchParams.get('workId'),
			offset: event.url.searchParams.get('offset') ?? 0
		});
		enforceRateLimit('search', userId);
		return json(
			editionsResponseSchema.parse(await editionsService.get(query.workId, query.offset)),
			{ headers: PRIVATE_NO_STORE }
		);
	} catch (error) {
		return errorResponse(error);
	}
};
