import { withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

/** Export completo dei dati dell'utente (spec §41): libri, letture, eventi, review, citazioni, bingo, preferenze. */
export const GET: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => {
		const data = await settings.exportData();
		const day = data.exportedAt.slice(0, 10);

		return new Response(JSON.stringify(data, null, 2), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'content-disposition': `attachment; filename="segnalibro-export-${day}.json"`,
				'cache-control': 'no-store',
				'x-content-type-options': 'nosniff'
			}
		});
	});
