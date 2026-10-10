import { parseYearParam } from '$lib/explore/calendar';
import { currentYear, loadProfilePage } from './profile-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, depends }) => {
	depends('app:profile', 'app:reading', 'app:library', 'app:queue', 'app:quotes');
	const year = currentYear();
	return loadProfilePage(
		locals.repos,
		year,
		url.searchParams.get('tab'),
		parseYearParam(url.searchParams.get('year'), year)
	);
};
