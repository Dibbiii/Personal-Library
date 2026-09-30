import { json } from '@sveltejs/kit';
import { uuidSchema } from '$lib/contracts/primitives';
import { errorResponse, withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = (event) =>
	withRepository(event, 'themes', async (themes) => {
		const id = uuidSchema.safeParse(event.params.id);
		if (!id.success) return errorResponse('VALIDATION', 'Tema non valido.');

		await themes.deleteCustom(id.data);
		return json({ ok: true });
	});
