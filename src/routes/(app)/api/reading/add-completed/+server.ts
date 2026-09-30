import { json } from '@sveltejs/kit';
import { addCompletedRequestSchema } from '$lib/client/reading-contract';
import { handle, parseBody } from '../_http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) =>
	handle(event, 'reading', async (reading) => {
		const input = await parseBody(event.request, addCompletedRequestSchema);
		return json(await reading.addCompletedReading(input));
	});
