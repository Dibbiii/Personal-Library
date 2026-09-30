import { json, type RequestHandler } from '@sveltejs/kit';
import { addBookRequestSchema, addBookResponseSchema } from '$lib/catalog/schemas';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	readJsonBody,
	requireUserId
} from '$lib/server/catalog/api';

/**
 * POST /api/library/add (JSON) -> { status: 'added', bookId } oppure { status: 'duplicate', … }.
 * L'utente è sempre quello della sessione.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const input = addBookRequestSchema.parse(await readJsonBody(event.request));
		enforceRateLimit('add', userId);

		const result = await getCatalogRepository(event).addBook(userId, input);
		return json(addBookResponseSchema.parse(result), {
			status: result.status === 'added' ? 201 : 200,
			headers: PRIVATE_NO_STORE
		});
	} catch (error) {
		return errorResponse(error);
	}
};
