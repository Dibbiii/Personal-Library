import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const extras = requireRepository(locals.repos, 'statsExtras');
	const { total, quotes } = await extras.listQuotes({ limit: 500 });
	return { total, quotes };
};
