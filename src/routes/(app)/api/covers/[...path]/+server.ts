import type { RequestHandler } from '@sveltejs/kit';
import { readCover, StorageError } from '$lib/server/storage';

/**
 * GET /api/covers/covers/<userId>/<uuid>.<png|jpg|webp> -> cover caricata dall'utente.
 * `readCover` accetta solo path nel formato generato da `saveCover` e verifica l'appartenenza
 * all'utente di sessione: path di altri utenti o malformati rispondono 404 (nessuna distinzione).
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const notFound = () =>
		new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	try {
		const cover = await readCover(params.path ?? '', locals.user.id);
		if (!cover) return notFound();
		return new Response(new Uint8Array(cover.data), {
			headers: {
				'content-type': cover.contentType,
				'content-length': String(cover.data.length),
				// Il nome file è un UUID mai riusato: il contenuto non cambia.
				'cache-control': 'private, max-age=31536000, immutable',
				'x-content-type-options': 'nosniff',
				'content-security-policy': "default-src 'none'; sandbox"
			}
		});
	} catch (error) {
		if (error instanceof StorageError) return notFound();
		console.error('[api/covers] lettura fallita', error);
		return new Response('Errore', { status: 500 });
	}
};
