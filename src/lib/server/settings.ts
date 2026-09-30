import type { Cookies } from '@sveltejs/kit';
import {
	DEFAULT_SHELF_MODE,
	SHELF_COOKIE,
	shelfModeSchema,
	type ShelfMode
} from '$lib/contracts/settings';
import type { Repositories } from '$lib/server/repositories';

/**
 * Modalità degli scaffali scelta dall'utente (`hybrid` | `spines` | `covers`), per la Home.
 *
 * Il profilo nel database è la sorgente; il cookie `sb-shelf` (scritto da /api/settings) è solo
 * il ripiego se il database non risponde. Non lancia mai: nel dubbio restituisce `hybrid`.
 *
 * ```ts
 * export const load = async ({ locals, cookies }) => ({
 *   shelfMode: await getShelfMode({ locals, cookies })
 * });
 * ```
 */
export async function getShelfMode(event: {
	locals: { repos: Repositories | null };
	cookies?: Pick<Cookies, 'get'>;
}): Promise<ShelfMode> {
	try {
		const settings = event.locals.repos?.settings;
		if (settings) return (await settings.get()).shelfMode;
	} catch {
		// database non raggiungibile: prova il cookie
	}

	const fromCookie = shelfModeSchema.safeParse(event.cookies?.get(SHELF_COOKIE));
	return fromCookie.success ? fromCookie.data : DEFAULT_SHELF_MODE;
}
