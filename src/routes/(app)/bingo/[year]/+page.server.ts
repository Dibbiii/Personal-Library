import { error } from '@sveltejs/kit';
import { DataAccessError } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	depends('app:reading', 'app:library', 'app:profile');
	const year = Number(params.year);
	if (!Number.isInteger(year) || year < 1900 || year > 2200) error(404, 'Anno non valido');

	const bingo = requireRepository(locals.repos, 'bingo');
	const { boards } = await bingo.listBoards();

	let board = null;
	if (boards.some((item) => item.year === year)) {
		try {
			board = await bingo.getBoard(year);
		} catch (failure) {
			if (!(failure instanceof DataAccessError && failure.code === 'NOT_FOUND')) throw failure;
		}
	}

	return { year, currentYear: new Date().getFullYear(), board, boards };
};
