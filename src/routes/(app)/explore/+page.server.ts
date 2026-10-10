import { requireRepository } from '$lib/server/repositories';
import { ownedKey } from '$lib/catalog/discover';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:library', 'app:reading');
	const context = await requireRepository(locals.repos, 'performance').getDiscoveryContext();
	const owned: [string, string][] = context.owned.map((book) => [
		ownedKey(book.title, book.author),
		book.id
	]);
	return { owned, topGenres: context.topGenres, currentYear: new Date().getFullYear() };
};
