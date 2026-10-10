import { error } from '@sveltejs/kit';
import { parseYearParam } from '$lib/explore/calendar';
import { loadProfilePage } from '../profile-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, url, depends }) => {
	depends('app:profile', 'app:reading', 'app:library', 'app:queue', 'app:quotes');
	const year = Number(params.year);
	if (!Number.isInteger(year) || year < 1900 || year > 2200) error(404, 'Anno non valido');
	return loadProfilePage(
		locals.repos,
		year,
		url.searchParams.get('tab'),
		parseYearParam(url.searchParams.get('year'), year)
	);
};
