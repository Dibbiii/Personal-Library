import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { genreSlugSchema, isoTimestampSchema, uuidSchema } from '$lib/contracts';
import { errorResponse, handle } from '../../reading/_http';
import type { RequestHandler } from './$types';

const querySchema = z.object({
	genre: genreSlugSchema,
	limit: z.coerce.number().int().min(1).max(100).default(24),
	cursorCreatedAt: isoTimestampSchema.optional(),
	cursorId: uuidSchema.optional()
});

/**
 * Pagina di uno scaffale (keyset). GET /api/library/shelf?genre=<slug>&limit=24[&cursorCreatedAt=..&cursorId=..]
 * Senza cursore restituisce dall'inizio: la Home lo usa la prima volta, perche' getHome non espone il cursore.
 */
export const GET: RequestHandler = (event) =>
	handle(event, 'library', async (library) => {
		const params = Object.fromEntries(event.url.searchParams);
		const parsed = querySchema.safeParse(params);
		if (!parsed.success) return errorResponse('VALIDATION', 'Parametri non validi.');
		const { genre, limit, cursorCreatedAt, cursorId } = parsed.data;
		const cursor =
			cursorCreatedAt && cursorId ? { createdAt: cursorCreatedAt, id: cursorId } : undefined;
		const result = await library.getShelfPage({ genre, limit, ...(cursor ? { cursor } : {}) });
		return json(result);
	});
