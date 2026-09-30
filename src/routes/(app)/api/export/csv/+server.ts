import { booksToCsv } from '$lib/server/export/csv';
import { withRepository } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

/** CSV dei libri (Excel/Fogli: UTF-8 con BOM, righe CRLF). */
export const GET: RequestHandler = (event) =>
	withRepository(event, 'settings', async (settings) => {
		const data = await settings.exportData();
		const day = data.exportedAt.slice(0, 10);

		return new Response(booksToCsv(data.books), {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="segnalibro-libri-${day}.csv"`,
				'cache-control': 'no-store',
				'x-content-type-options': 'nosniff'
			}
		});
	});
