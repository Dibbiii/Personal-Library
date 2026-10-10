import { json } from '@sveltejs/kit';
import { updateBookRequestSchema, updateBookResponseSchema } from '$lib/catalog/schemas';
import { DataAccessError } from '$lib/data/errors';
import { uuidSchema } from '$lib/contracts/primitives';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	readJsonBody,
	requireUserId
} from '$lib/server/catalog/api';
import type { RequestHandler } from './$types';

/** Aggiorna in place edizione e personalizzazione di un libro dell'utente. */
export const PATCH: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const bookId = uuidSchema.safeParse(event.params.id);
		if (!bookId.success) throw new DataAccessError('NOT_FOUND', 'Libro non trovato');

		const input = updateBookRequestSchema.parse(await readJsonBody(event.request));
		enforceRateLimit('edit', userId);
		const result = await getCatalogRepository(event).updateBook(userId, bookId.data, input);

		return json(updateBookResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error, PRIVATE_NO_STORE);
	}
};
