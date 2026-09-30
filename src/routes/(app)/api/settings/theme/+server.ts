import { json } from '@sveltejs/kit';
import { themeSelectionSchema } from '$lib/contracts/themes';
import { THEME_COOKIE } from '$lib/themes/registry';
import { parseJsonBody, withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

/** Salva il tema scelto sul profilo e riallinea il cookie `sb-theme` usato dall'SSR. */
export const PUT: RequestHandler = (event) =>
	withRepository(event, 'themes', async (themes) => {
		const selection = await parseJsonBody(event.request, themeSelectionSchema, 'Tema non valido.');
		const saved = await themes.setSelection({ selection });

		event.cookies.set(THEME_COOKIE, saved.kind === 'builtin' ? saved.key : saved.id, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		return json({ selection: saved });
	});
