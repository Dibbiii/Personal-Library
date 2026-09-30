import { currentYear, loadStatsPage } from './stats-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => loadStatsPage(locals.repos, currentYear());
