import { currentYear, loadProfilePage } from './profile-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, depends }) => {
	depends('app:profile', 'app:reading', 'app:library', 'app:queue', 'app:quotes');
	return loadProfilePage(locals.repos, currentYear(), url.searchParams.get('tab'));
};
