import { json } from '@sveltejs/kit';
import { addQuoteInputSchema } from '$lib/contracts/reviews';
import { handle, parseBody } from '../review/_http';
import type { RequestHandler } from './$types';

/** Aggiunge una citazione a un libro già letto almeno una volta. */
export const POST: RequestHandler = (event) =>
	handle(event, 'quotes', async (quotes) => {
		const input = await parseBody(event.request, addQuoteInputSchema);
		const quote = await quotes.add(input);
		return json({ contractVersion: 1, quote }, { status: 201 });
	});
