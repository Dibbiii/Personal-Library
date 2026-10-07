import { requireRepository } from '$lib/server/repositories';
import { ownedKey } from '$lib/catalog/discover';
import type { GenreSlug } from '$lib/contracts/enums';
import type { PageServerLoad } from './$types';

/** Scaffali caricati per intero: servono a riconoscere i libri già in libreria. */
const SHELF_LIMIT = 100;

export const load: PageServerLoad = async ({ locals }) => {
	const library = requireRepository(locals.repos, 'library');
	const home = await library.getHome({ shelfLimit: SHELF_LIMIT });

	const owned: [string, string][] = [];
	const books = [
		...home.shelves.flatMap((shelf) => shelf.books),
		...home.currentlyReading.map((item) => item.book),
		...home.queue.map((item) => item.book)
	];
	for (const book of books) owned.push([ownedKey(book.title, book.author), book.id]);

	// I due generi più presenti in libreria guidano i consigli.
	const topGenres: GenreSlug[] = home.shelves
		.filter((shelf) => shelf.totalCount > 0)
		.sort((a, b) => b.totalCount - a.totalCount)
		.slice(0, 2)
		.map((shelf) => shelf.genre.slug);

	return { owned, topGenres, currentYear: new Date().getFullYear() };
};
