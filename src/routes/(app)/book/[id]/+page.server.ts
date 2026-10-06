import { error } from '@sveltejs/kit';
import { DataAccessError } from '$lib/data';
import { uuidSchema } from '$lib/contracts/primitives';
import { requireRepository } from '$lib/server/repositories';
import { getBookInfoService } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	// Stesso nome di QUEUE_DEPENDENCY ($lib/client/queue.svelte): le modifiche alla coda ricaricano il dettaglio.
	depends('app:queue');

	const id = uuidSchema.safeParse(params.id);
	if (!id.success) error(404, 'Libro non trovato');

	const library = requireRepository(locals.repos, 'library');

	try {
		const [detail, home] = await Promise.all([
			library.getBookDetail(id.data),
			// Serve solo la lunghezza della coda ("N su 3"): basta uno scaffale per libro.
			library.getHome({ shelfLimit: 1 })
		]);
		// Dati pubblici (Open Library): non bloccano la pagina, arrivano in streaming.
		const info = getBookInfoService()
			.get({
				title: detail.book.title,
				author: detail.book.author,
				language: detail.book.language
			})
			.catch(() => null);
		return { detail, queueCount: home.queue.length, info };
	} catch (cause) {
		if (cause instanceof DataAccessError && cause.code === 'NOT_FOUND') {
			error(404, 'Libro non trovato');
		}
		throw cause;
	}
};
