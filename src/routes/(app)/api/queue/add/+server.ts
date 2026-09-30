import { json } from '@sveltejs/kit';
import { queueAddInputSchema } from '$lib/contracts';
import { handle, parseBody } from '../../reading/_http';
import type { RequestHandler } from './$types';

/**
 * Aggiunge un libro ai prossimi. Il soft limit (3) non e' un errore: con `status: "requiresConfirmation"`
 * nulla viene scritto finche' il client non ripete la chiamata con `force: true`.
 */
export const POST: RequestHandler = (event) =>
	handle(event, 'queue', async (queue) => {
		const { bookId, force } = await parseBody(event.request, queueAddInputSchema);
		const result = await queue.add(bookId, { force });
		return json(result);
	});
