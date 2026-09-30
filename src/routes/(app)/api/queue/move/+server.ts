import { json } from '@sveltejs/kit';
import { queueMoveInputSchema } from '$lib/contracts';
import { handle, parseBody } from '../../reading/_http';
import type { RequestHandler } from './$types';

/** Sposta un libro a `newPosition` (1-based) nella coda. Risponde con la coda aggiornata. */
export const POST: RequestHandler = (event) =>
	handle(event, 'queue', async (queue) => {
		const input = await parseBody(event.request, queueMoveInputSchema);
		return json({ contractVersion: 1, queue: await queue.move(input) });
	});
