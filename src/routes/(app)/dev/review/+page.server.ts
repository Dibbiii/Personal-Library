import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { uuidSchema } from '$lib/contracts/primitives';
import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

// Banco di prova del pannello recensione: solo in sviluppo (`?book=<uuid>`).
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!dev) error(404, 'Not found');

	const library = requireRepository(locals.repos, 'library');
	const param = url.searchParams.get('book');
	const bookId = param ? uuidSchema.safeParse(param) : null;

	if (bookId?.success) {
		return { detail: await library.getBookDetail(bookId.data), choices: [] };
	}

	const home = await library.getHome({ shelfLimit: 48 });
	const choices = home.shelves
		.flatMap((shelf) => shelf.books)
		.map((book) => ({
			id: book.id,
			title: book.title,
			author: book.author,
			completed: book.completedReadingsCount
		}));
	return { detail: null, choices };
};
