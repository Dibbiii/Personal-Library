import { error } from '@sveltejs/kit';
import { loadStatsPage } from '../stats-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const year = Number(params.year);
	if (!Number.isInteger(year) || year < 1900 || year > 2200) error(404, 'Anno non valido');
	return loadStatsPage(locals.repos, year);
};
