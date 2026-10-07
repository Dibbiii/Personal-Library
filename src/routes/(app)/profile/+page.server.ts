import { currentYear, loadProfilePage } from './profile-load.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => loadProfilePage(locals.repos, currentYear());
