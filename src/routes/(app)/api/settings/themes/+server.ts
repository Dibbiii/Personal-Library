import { json } from '@sveltejs/kit';
import { saveCustomThemeBodySchema } from '$lib/contracts/settings';
import { parseJsonBody, withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

/** Temi disponibili: built-in (nel codice) e custom dell'utente. */
export const GET: RequestHandler = (event) =>
	withRepository(event, 'themes', async (themes) => {
		const [builtins, custom] = await Promise.all([themes.listBuiltins(), themes.listCustom()]);
		return json({ builtins, custom });
	});

/** Crea o aggiorna un tema custom. Il JSON è rivalidato (schemaVersion, #RRGGBB): mai CSS libero. */
export const POST: RequestHandler = (event) =>
	withRepository(event, 'themes', async (themes) => {
		const { theme, id } = await parseJsonBody(
			event.request,
			saveCustomThemeBodySchema,
			'Tema non valido.'
		);
		const saved = await themes.saveCustom(id ? { ...theme, id } : theme);
		return json({ theme: saved }, { status: 201 });
	});
