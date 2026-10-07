import { error } from '@sveltejs/kit';
import { DataAccessError } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Sessione non valida');

	try {
		const settings = requireRepository(locals.repos, 'settings');
		const themes = requireRepository(locals.repos, 'themes');

		const [current, builtins, custom, genreShelves] = await Promise.all([
			settings.get(),
			themes.listBuiltins(),
			themes.listCustom(),
			settings.getGenreShelves()
		]);

		return { settings: current, builtins, custom, genreShelves: genreShelves.genres, email: user.email };
	} catch (cause) {
		if (cause instanceof DataAccessError) error(503, 'Impostazioni non disponibili al momento.');
		throw cause;
	}
};
