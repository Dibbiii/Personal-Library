import { json } from '@sveltejs/kit';
import { startReadingRequestSchema } from '$lib/client/reading-contract';
import { handle, parseBody } from '../_http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) =>
	handle(event, 'reading', async (reading) => {
		const input = await parseBody(event.request, startReadingRequestSchema);
		return json(await reading.start(input));
	});
