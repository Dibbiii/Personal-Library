import { json } from '@sveltejs/kit';
import { readingEventRequestSchema } from '$lib/client/reading-contract';
import { handle, parseBody } from '../_http';
import type { RequestHandler } from './$types';

/**
 * Destinatario dell'outbox offline. Idempotente: l'eventId è la chiave, un secondo invio
 * restituisce la stessa lettura con `duplicate: true` senza contare due volte le pagine.
 */
export const POST: RequestHandler = (event) =>
	handle(event, 'reading', async (reading) => {
		const { operation, ...input } = await parseBody(event.request, readingEventRequestSchema);
		switch (operation) {
			case 'progress':
				return json(await reading.recordProgress(input));
			case 'correction':
				return json(await reading.correctProgress(input));
			case 'finish':
				return json(await reading.finish(input));
			case 'dnf':
				return json(await reading.markDnf(input));
		}
	});
