import { error } from '@sveltejs/kit';
import { DataAccessError } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';
import { isGenreSlug } from '$lib/genres';
import { parseGenreSort } from '$lib/components/genre/sort';
import type { PageServerLoad } from './$types';

// Il limite massimo della RPC: una vista genere resta una pagina unica.
const GENRE_VIEW_LIMIT = 200;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	if (!isGenreSlug(params.slug)) error(404, 'Genere non trovato');

	const sort = parseGenreSort(url.searchParams);
	const library = requireRepository(locals.repos, 'library');

	try {
		// La coda serve solo al badge "Prossimo": basta uno scaffale per non caricare tutta la Home.
		const [view, home] = await Promise.all([
			library.getGenreView({
				genre: params.slug,
				sortField: sort.field,
				direction: sort.direction,
				limit: GENRE_VIEW_LIMIT
			}),
			library.getHome({ shelfLimit: 1 })
		]);

		return {
			view,
			queuedIds: home.queue.map((entry) => entry.book.id)
		};
	} catch (cause) {
		if (cause instanceof DataAccessError && cause.code === 'NOT_FOUND') {
			error(404, 'Genere non trovato');
		}
		throw cause;
	}
};
