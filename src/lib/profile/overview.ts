import type {
	BookSummary,
	DnfBook,
	GenreSlug,
	LibraryHomeResponse,
	ReadingCalendarDay
} from '$lib/contracts';
import { dateKey } from '$lib/explore/calendar';

/**
 * Derivazioni pure della pagina Profilo: tutto si calcola dai dati già esposti
 * da libreria, calendario e dashboard, senza RPC dedicate.
 */

export interface LibraryCounts {
	total: number;
	read: number;
	reading: number;
	unread: number;
	physical: number;
	digital: number;
	/** Posseduti sia in cartaceo sia in digitale. */
	both: number;
	/** Libri completati la cui lingua è inglese (en, eng, en-GB, en-US). */
	englishRead: number;
	reread: number;
}

/** Tutti i libri caricati negli scaffali della Home (fino al limite per scaffale). */
export function libraryBooks(home: LibraryHomeResponse): BookSummary[] {
	return home.shelves.flatMap((shelf) => shelf.books);
}

export function libraryCounts(home: LibraryHomeResponse): LibraryCounts {
	const books = libraryBooks(home);
	return {
		total: home.shelves.reduce((sum, shelf) => sum + shelf.totalCount, 0),
		read: books.filter((book) => book.completedReadingsCount > 0).length,
		reading: home.currentlyReading.length,
		unread: books.filter(
			(book) => book.lifecycleState === 'unread' && book.completedReadingsCount === 0
		).length,
		physical: books.filter((book) => book.format === 'physical').length,
		digital: books.filter((book) => book.format === 'digital').length,
		both: books.filter((book) => book.format === 'both').length,
		englishRead: books.filter(
			(book) => book.completedReadingsCount > 0 && /^(en|eng)(-|$)/i.test(book.language ?? '')
		).length,
		reread: books.filter((book) => book.completedReadingsCount > 1).length
	};
}

/** Libri con il voto più alto (a parità, il più recente), solo se recensiti. */
export function favoriteBooks(books: readonly BookSummary[], limit = 5): BookSummary[] {
	return books
		.filter((book) => book.reviewRating !== null)
		.sort(
			(a, b) =>
				(b.reviewRating ?? 0) - (a.reviewRating ?? 0) ||
				(b.lastFinishedAt ?? '').localeCompare(a.lastFinishedAt ?? '')
		)
		.slice(0, limit);
}

export type ActivityKind = 'finished' | 'started' | 'queued' | 'dnf';

export interface ActivityItem {
	kind: ActivityKind;
	book: BookSummary;
	at: string;
}

/** Ultimi eventi della libreria: letture finite, iniziate, abbandonate e libri messi in coda. */
export function recentActivity(
	home: LibraryHomeResponse,
	dnf: readonly DnfBook[],
	limit = 5
): ActivityItem[] {
	const items: ActivityItem[] = [];
	for (const book of libraryBooks(home)) {
		if (book.lastFinishedAt) items.push({ kind: 'finished', book, at: book.lastFinishedAt });
	}
	for (const entry of home.currentlyReading) {
		items.push({ kind: 'started', book: entry.book, at: entry.reading.startedAt });
	}
	for (const entry of home.queue) {
		items.push({ kind: 'queued', book: entry.book, at: entry.addedAt });
	}
	for (const entry of dnf) {
		if (entry.dnfAt) items.push({ kind: 'dnf', book: entry.book, at: entry.dnfAt });
	}
	return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

export const ACTIVITY_VERBS: Record<ActivityKind, string> = {
	finished: 'Hai terminato',
	started: 'Hai iniziato',
	queued: 'Hai messo in coda',
	dnf: 'Hai lasciato'
};

const relative = new Intl.RelativeTimeFormat('it', { numeric: 'auto' });

/** "oggi", "2 giorni fa", "3 settimane fa", "5 mesi fa". */
export function relativeTime(iso: string, now: Date = new Date()): string {
	const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
	if (days < 7) return relative.format(-days, 'day');
	if (days < 30) return relative.format(-Math.floor(days / 7), 'week');
	if (days < 365) return relative.format(-Math.floor(days / 30), 'month');
	return relative.format(-Math.floor(days / 365), 'year');
}

function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parts(date: string): [number, number, number] {
	const [y, m, d] = date.split('-').map(Number);
	return [y ?? 0, m ?? 1, d ?? 1];
}

/** Pagine lette per mese (indice 0 = gennaio). */
export function pagesByMonth(days: readonly ReadingCalendarDay[]): number[] {
	const months = Array.from({ length: 12 }, () => 0);
	for (const day of days) months[parts(day.date)[1] - 1]! += day.pagesRead;
	return months;
}

/** Giorni con almeno una lettura registrata, per mese. */
export function readingDaysByMonth(days: readonly ReadingCalendarDay[]): number[] {
	const months = Array.from({ length: 12 }, () => 0);
	for (const day of days) months[parts(day.date)[1] - 1]! += 1;
	return months;
}

/** Matrice giorno della settimana (0 = lunedì) x mese con le pagine lette. */
export function weekdayMonthMatrix(days: readonly ReadingCalendarDay[]): number[][] {
	const matrix = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
	for (const day of days) {
		const [y, m, d] = parts(day.date);
		const date = new Date(Date.UTC(2000, m - 1, d));
		date.setUTCFullYear(y);
		matrix[(date.getUTCDay() + 6) % 7]![m - 1]! += day.pagesRead;
	}
	return matrix;
}

export interface WeekDay {
	key: string;
	label: string;
	read: boolean;
	today: boolean;
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** Gli ultimi 7 giorni (oggi compreso, in fondo) con lo stato "ho letto". */
export function lastSevenDays(
	days: readonly ReadingCalendarDay[],
	now: Date = new Date()
): WeekDay[] {
	const read = new Set(days.filter((day) => day.pagesRead > 0).map((day) => day.date));
	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
		const key = dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
		return { key, label: WEEKDAY_SHORT[date.getDay()]!, read: read.has(key), today: i === 6 };
	});
}

export interface GenreShare {
	slug: GenreSlug;
	count: number;
	percent: number;
}

/** Quote percentuali (arrotondate) dei generi letti, in ordine decrescente. */
export function genreShares(entries: readonly { slug: GenreSlug; count: number }[]): GenreShare[] {
	const total = entries.reduce((sum, entry) => sum + entry.count, 0);
	if (total === 0) return [];
	return entries
		.filter((entry) => entry.count > 0)
		.map((entry) => ({ ...entry, percent: Math.round((entry.count / total) * 100) }))
		.sort((a, b) => b.count - a.count);
}

export function percentOf(part: number, total: number): number {
	return total > 0 ? Math.round((part / total) * 100) : 0;
}
