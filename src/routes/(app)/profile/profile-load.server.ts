import type { Repositories } from '$lib/server/repositories';
import { requireRepository } from '$lib/server/repositories';

/** Quanti anni precedenti a quello corrente offre il selettore, oltre a quelli con una card Bingo. */
const EXTRA_YEARS = 4;

/** Scaffali caricati per intero (limite della RPC): servono a conteggi, preferiti e attività. */
const SHELF_LIMIT = 100;

export function currentYear(): number {
	return new Date().getFullYear();
}

/** Dati del Profilo per un anno (condivisi da /profile e /profile/[year]). */
export async function loadProfilePage(repos: Repositories | null, year: number) {
	const stats = requireRepository(repos, 'stats');
	const extras = requireRepository(repos, 'statsExtras');
	const bingo = requireRepository(repos, 'bingo');
	const library = requireRepository(repos, 'library');

	const [dashboard, breakdown, boards, calendar, home, quotes] = await Promise.all([
		stats.getDashboard(year),
		extras.getGenreBreakdown(year),
		bingo.listBoards(),
		stats.getCalendar(year),
		library.getHome({ shelfLimit: SHELF_LIMIT }),
		extras.listQuotes({ limit: 1 })
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
		quoteCount: quotes.total,
		dnf: dashboard.dnf,
		calendar: calendar.days,
		home
	};
}
