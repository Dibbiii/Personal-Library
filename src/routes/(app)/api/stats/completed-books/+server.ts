import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { completedBooksResponseSchema } from '$lib/contracts';
import { errorResponse, handle } from '../_http';
import type { RequestHandler } from './$types';

const querySchema = z.object({
	q: z.string().trim().max(120).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

/** Libri con almeno una lettura completata (candidati per le caselle del Bingo), con ricerca. */
export const GET: RequestHandler = (event) =>
	handle(event, 'statsExtras', async (extras) => {
		const parsed = querySchema.safeParse(Object.fromEntries(event.url.searchParams));
		if (!parsed.success) return errorResponse('VALIDATION', 'Parametri non validi.');

		const result = await extras.listCompletedBooks({
			limit: parsed.data.limit,
			...(parsed.data.q ? { query: parsed.data.q } : {})
		});
		return json(completedBooksResponseSchema.parse(result));
	});
