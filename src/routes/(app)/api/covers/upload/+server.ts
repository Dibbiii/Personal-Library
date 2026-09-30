import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { coverChangedResponseSchema } from '$lib/catalog/schemas';
import { MAX_COVER_BYTES } from '$lib/server/storage';
import {
	enforceRateLimit,
	errorResponse,
	getCatalogRepository,
	PRIVATE_NO_STORE,
	requireUserId
} from '$lib/server/catalog/api';
import { DataAccessError } from '$lib/data/errors';

// Multipart: margine per boundary e campi oltre ai 5 MB del file.
const MAX_REQUEST_BYTES = MAX_COVER_BYTES + 256 * 1024;

/** POST /api/covers/upload (multipart: bookId, file) -> cover personalizzata (png/jpeg/webp, max 5 MB). */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireUserId(event);
		enforceRateLimit('cover', userId);

		const declared = Number(event.request.headers.get('content-length') ?? '0');
		if (declared > MAX_REQUEST_BYTES) {
			return json({ code: 'VALIDATION', message: 'L’immagine supera i 5 MB.' }, { status: 413 });
		}

		let form: FormData;
		try {
			form = await event.request.formData();
		} catch {
			throw new DataAccessError('VALIDATION', 'Richiesta non valida.');
		}

		const bookId = z.string().uuid().safeParse(form.get('bookId'));
		const file = form.get('file');
		if (!bookId.success) throw new DataAccessError('VALIDATION', 'Libro non valido.');
		if (!(file instanceof File)) throw new DataAccessError('VALIDATION', 'Scegli un’immagine.');

		const state = await getCatalogRepository(event).setCustomCover(userId, bookId.data, file);
		return json(coverChangedResponseSchema.parse(state), { headers: PRIVATE_NO_STORE });
	} catch (error) {
		return errorResponse(error);
	}
};
