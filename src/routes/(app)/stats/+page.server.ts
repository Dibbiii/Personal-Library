import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Statistiche ora vive nel Profilo: i vecchi link restano validi.
export const load: PageServerLoad = () => redirect(308, '/profile?tab=stats');
