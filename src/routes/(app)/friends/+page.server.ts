import { error } from '@sveltejs/kit';
import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) error(401, 'Sessione non valida');
	const friends = requireRepository(locals.repos, 'friendships');
	return await friends.getAll();
};