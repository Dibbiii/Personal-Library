import { json } from '@sveltejs/kit';
import { updateQuoteInputSchema } from '$lib/contracts/reviews';
import { uuidSchema } from '$lib/contracts/primitives';
import { errorResponse, handle, parseBody } from '../../review/_http';
import type { RequestHandler } from './$types';

const bodySchema = updateQuoteInputSchema.omit({ quoteId: true });

/** Modifica testo e pagina di una citazione. */
export const PATCH: RequestHandler = (event) =>
	handle(event, 'quotes', async (quotes) => {
		const id = uuidSchema.safeParse(event.params.id);
		if (!id.success) return errorResponse('NOT_FOUND');
		const input = await parseBody(event.request, bodySchema);
		const quote = await quotes.update({ quoteId: id.data, ...input });
		return json({ contractVersion: 1, quote });
	});

/** Elimina una citazione. */
export const DELETE: RequestHandler = (event) =>
	handle(event, 'quotes', async (quotes) => {
		const id = uuidSchema.safeParse(event.params.id);
		if (!id.success) return errorResponse('NOT_FOUND');
		await quotes.remove(id.data);
		return json({ contractVersion: 1, ok: true });
	});
