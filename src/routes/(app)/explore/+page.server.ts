import { requireRepository } from '$lib/server/repositories';
import { parseYearParam } from '$lib/explore/calendar';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const explore = requireRepository(locals.repos, 'explore');
	const stats = requireRepository(locals.repos, 'stats');

	const currentYear = new Date().getFullYear();
	const year = parseYearParam(url.searchParams.get('year'), currentYear);

	const [pool, calendar] = await Promise.all([explore.getPool(), stats.getCalendar(year)]);

	return { pool, year, currentYear, days: calendar.days };
};
