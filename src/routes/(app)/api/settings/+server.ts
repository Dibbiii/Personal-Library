import { json } from '@sveltejs/kit';
import {
	MOTION_COOKIE,
	SHELF_COOKIE,
	updateSettingsInputSchema,
	type UserSettings
} from '$lib/contracts/settings';
import { withRepository, parseJsonBody } from '$lib/server/settings-http';
import type { Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function mirrorCookies(cookies: Cookies, settings: UserSettings): void {
	// Copie leggibili dal documento iniziale (no-flash): il profilo nel DB resta la sorgente.
	const options = {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	} as const;
	cookies.set(MOTION_COOKIE, settings.motionPreference, options);
	cookies.set(SHELF_COOKIE, settings.shelfMode, options);
}

/** Impostazioni correnti, più la definizione del tema custom se è quello selezionato. */
export const GET: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => {
		const current = await settings.get();
		mirrorCookies(event.cookies, current);

		let customTheme = null;
		if (current.selection.kind === 'custom') {
			const { id } = current.selection;
			const themes = event.locals.repos?.themes;
			customTheme = themes ? ((await themes.listCustom()).find((t) => t.id === id) ?? null) : null;
		}
		return json({ settings: current, customTheme });
	});

export const PATCH: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => {
		const input = await parseJsonBody(
			event.request,
			updateSettingsInputSchema,
			'Impostazioni non valide.'
		);
		const updated = await settings.update(input);
		mirrorCookies(event.cookies, updated);
		return json({ settings: updated });
	});
