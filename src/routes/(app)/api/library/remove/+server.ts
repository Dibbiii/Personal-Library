import { json, type RequestHandler } from '@sveltejs/kit';
import {
	bookRemovalResponseSchema,
	removeBookRequestSchema
} from '$lib/contracts/library-mutations';
import {
	errorResponse,
	PRIVATE_NO_STORE,
	readJsonBody,
	requireUserId
} from '$lib/server/catalog/api';
import { requireRepository } from '$lib/server/repositories';
import { deleteCover } from '$lib/server/storage';

export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		const { bookId } = removeBookRequestSchema.parse(await readJsonBody(event.request));
		const library = requireRepository(event.locals.repos, 'library');
		const result = await library.removeBook(bookId);

		// Il DB ha già confermato la rimozione: un errore filesystem non deve farla apparire fallita.
		if (result.coverStoragePath) {
			try {
				await deleteCover(result.coverStoragePath, userId);
			} catch (cause) {
				console.error('[api/library/remove] Pulizia cover da ripetere', {
					userId,
					bookId,
					coverStoragePath: result.coverStoragePath,
					cause
				});
			}
		}

		return json(bookRemovalResponseSchema.parse(result), { headers: PRIVATE_NO_STORE });
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};
