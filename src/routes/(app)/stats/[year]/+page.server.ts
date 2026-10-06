import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Statistiche ora vive nel Profilo: i vecchi link restano validi.
export const load: PageServerLoad = ({ params }) =>
	redirect(308, `/profile/${encodeURIComponent(params.year)}?tab=stats`);
