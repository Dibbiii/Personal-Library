import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Galleria dei componenti condivisi: solo in sviluppo.
export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
};
