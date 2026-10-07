import { json } from '@sveltejs/kit';
import { updateUserGenreShelvesInputSchema } from '$lib/contracts/settings';
import { parseJsonBody, withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => json(await settings.getGenreShelves()));

export const PUT: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => {
		const input = await parseJsonBody(
			event.request,
			updateUserGenreShelvesInputSchema,
			'Scaffali non validi.'
		);
		return json(await settings.updateGenreShelves(input));
	});
