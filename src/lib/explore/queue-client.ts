import { queueAddResponseSchema, type QueueAddResponse } from '$lib/contracts/rpc';

/**
 * Aggiunge un libro ai "prossimi" tramite `POST /api/queue/add` (feature Home/Coda).
 * Con `force: false` il server risponde `requiresConfirmation` se il limite morbido è superato.
 * Se B1 pubblica `addToQueue` in `$lib/client/queue.svelte.ts`, può sostituire questo modulo.
 */
export async function requestQueueAdd(bookId: string, force = false): Promise<QueueAddResponse> {
	const response = await fetch('/api/queue/add', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ bookId, force })
	});
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null && 'message' in payload
				? String((payload as { message: unknown }).message)
				: 'Impossibile aggiungere il libro ai prossimi.';
		throw new Error(message);
	}
	return queueAddResponseSchema.parse(payload);
}
