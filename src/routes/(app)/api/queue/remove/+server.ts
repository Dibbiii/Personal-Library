import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { uuidSchema } from '$lib/contracts';
import { handle, parseBody } from '../../reading/_http';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ bookId: uuidSchema });

/** Toglie un libro dai prossimi (no-op se non c'e'). Risponde con la coda aggiornata. */
export const POST: RequestHandler = (event) =>
	handle(event, 'queue', async (queue) => {
		const { bookId } = await parseBody(event.request, bodySchema);
		return json({ contractVersion: 1, queue: await queue.remove(bookId) });
	});
