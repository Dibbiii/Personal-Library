import type { Repositories } from '$lib/server/repositories';
import { requireRepository } from '$lib/server/repositories';

/** Quanti anni precedenti a quello corrente offre il selettore, oltre a quelli con una card Bingo. */
const EXTRA_YEARS = 4;

export function currentYear(): number {
	return new Date().getFullYear();
}

/** Dati della pagina Statistiche per un anno (condivisi da /stats e /stats/[year]). */
export async function loadStatsPage(repos: Repositories | null, year: number) {
	const stats = requireRepository(repos, 'stats');
	const extras = requireRepository(repos, 'statsExtras');
	const bingo = requireRepository(repos, 'bingo');

	const [dashboard, breakdown, boards] = await Promise.all([
		stats.getDashboard(year),
		extras.getGenreBreakdown(year),
		bingo.listBoards()
	]);

	const thisYear = currentYear();
	const years = new Set<number>([year, thisYear]);
	for (let offset = 1; offset <= EXTRA_YEARS; offset += 1) years.add(thisYear - offset);
	for (const board of boards.boards) years.add(board.year);

	return {
		year,
		currentYear: thisYear,
		years: [...years].sort((a, b) => b - a),
		stats: dashboard.stats,
		genreBreakdown: breakdown.genres.map((entry) => ({
			slug: entry.genre.slug,
			count: entry.booksFinished
		})),
		bingo: boards.boards.find((board) => board.year === year) ?? null,
		quotes: dashboard.quotePreviews,
		dnf: dashboard.dnf
	};
}
