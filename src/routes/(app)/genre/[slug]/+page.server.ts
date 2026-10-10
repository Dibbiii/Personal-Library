import { error, redirect } from '@sveltejs/kit';
import { DataAccessError } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';
import { isGenreSlug } from '$lib/genres';
import { parseGenreSort } from '$lib/components/genre/sort';
import type { PageServerLoad } from './$types';
import { unreadSortSchema } from '$lib/contracts/performance';
import { parsePage, pageHref } from '$lib/pagination';

export const load: PageServerLoad = async ({ params, url, locals, depends }) => {
	depends('app:library', 'app:reading', 'app:queue');
	if (!isGenreSlug(params.slug)) error(404, 'Genere non trovato');

	const sort = parseGenreSort(url.searchParams);
	const repository = requireRepository(locals.repos, 'performance');
	const unreadSort = unreadSortSchema.safeParse(url.searchParams.get('unreadSort'));
	const readPage = parsePage(url.searchParams.get('readPage'));
	const unreadPage = parsePage(url.searchParams.get('unreadPage'));

	try {
		const [view, queue] = await Promise.all([
			repository.getGenrePages({
				genre: params.slug,
				sortField: sort.field,
				direction: sort.direction,
				unreadSort: unreadSort.success ? unreadSort.data : 'title',
				readPage,
				unreadPage
			}),
			repository.getQueueSummary()
		]);
		if (readPage !== view.pages.read || unreadPage !== view.pages.unread) {
			const corrected = new URL(pageHref(url, 'readPage', view.pages.read), url);
			redirect(303, pageHref(corrected, 'unreadPage', view.pages.unread));
		}

		return {
			view,
			queuedIds: queue.ids
		};
	} catch (cause) {
		if (cause instanceof DataAccessError && cause.code === 'NOT_FOUND') {
			error(404, 'Genere non trovato');
		}
		throw cause;
	}
};
