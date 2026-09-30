import { json } from '@sveltejs/kit';
import { readingIdRequestSchema } from '$lib/client/reading-contract';
import { handle, parseBody } from '../_http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) =>
	handle(event, 'reading', async (reading) => {
		const { readingId } = await parseBody(event.request, readingIdRequestSchema);
		return json(await reading.resume(readingId));
	});
