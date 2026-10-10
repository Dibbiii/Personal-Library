import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { uuidSchema } from '$lib/contracts/primitives';
import { parsePage, pageHref } from '$lib/pagination';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:quotes', 'app:library');
	const parsedBook = uuidSchema.safeParse(url.searchParams.get('book'));
	const bookId = parsedBook.success ? parsedBook.data : null;
	const requested = parsePage(url.searchParams.get('page'));
	const result = await requireRepository(locals.repos, 'performance').getQuotesPage(
		requested,
		bookId
	);
	if (requested !== result.page) redirect(303, pageHref(url, 'page', result.page));
	return { ...result, bookId };
};
