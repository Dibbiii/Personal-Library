import { error } from '@sveltejs/kit';
import { requireRepository } from '$lib/server/repositories';
import { DataAccessError } from '$lib/data/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	depends('app:friends', 'app:reading', 'app:library');
	if (!locals.user) error(401, 'Sessione non valida');
	try {
		return await requireRepository(locals.repos, 'friendships').getProfile(params.id);
	} catch (cause) {
		if (cause instanceof DataAccessError && cause.code === 'NOT_FOUND')
			error(404, 'Amico non trovato');
		throw cause;
	}
};
