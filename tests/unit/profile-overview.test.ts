import { describe, expect, it } from 'vitest';
import type { BookSummary, LibraryHomeResponse } from '../../src/lib/contracts';
import {
	favoriteBooks,
	genreShares,
	lastSevenDays,
	libraryCounts,
	pagesByMonth,
	readingDaysByMonth,
	recentActivity,
	relativeTime,
	weekdayMonthMatrix
} from '../../src/lib/profile/overview';

let seq = 0;
function book(overrides: Partial<BookSummary> = {}): BookSummary {
	seq += 1;
	return {
		id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
		editionId: null,
		title: `Libro ${seq}`,
		author: 'Autrice',
		pageCount: 200,
		language: 'it',
		format: 'physical',
		source: 'manual',
		genre: { id: 1, slug: 'classics', name: 'Classici' },
		series: null,
		lifecycleState: 'unread',
		completedReadingsCount: 0,
		reviewRating: null,
		lastFinishedAt: null,
		lastActivityAt: null,
		cover: { coverUrl: null, coverStoragePath: null },
		...overrides
	};
}

function home(books: BookSummary[], extra: Partial<LibraryHomeResponse> = {}): LibraryHomeResponse {
	return {
		contractVersion: 1,
		currentlyReading: [],
		queue: [],
		shelves: [
			{
				genre: { id: 1, slug: 'classics', name: 'Classici' },
				totalCount: books.length,
				hasMore: false,
				books
			}
		],
		...extra
	} as LibraryHomeResponse;
}

const day = (date: string, pagesRead: number) => ({
	date,
	pagesRead,
	genres: [{ genre: { id: 1, slug: 'classics' as const, name: 'Classici' }, pagesRead }]
});

describe('conteggi della libreria', () => {
	it('separa letti, da leggere, formati e riletture', () => {
		const reading = book({ lifecycleState: 'reading' });
		const counts = libraryCounts(
			home(
				[
					book({ completedReadingsCount: 1, lifecycleState: 'finished' }),
					book({ completedReadingsCount: 2, lifecycleState: 'finished', format: 'digital' }),
					book(),
					book({ lifecycleState: 'dnf' }),
					reading
				],
				{
					currentlyReading: [
						{
							book: reading,
							reading: {
								id: reading.id,
								currentPage: 10,
								totalPages: 200,
								progressPercent: 5,
								startedAt: '2026-09-01T10:00:00Z',
								paused: false
							}
						}
					]
				}
			)
		);
		expect(counts).toEqual({
			total: 5,
			read: 2,
			reading: 1,
			unread: 1,
			physical: 4,
			digital: 1,
			reread: 1
		});
	});
});

describe('preferiti', () => {
	it('solo libri recensiti, voto più alto e poi lettura più recente', () => {
		const a = book({ reviewRating: 4, lastFinishedAt: '2026-01-01T00:00:00Z' });
		const b = book({ reviewRating: 5, lastFinishedAt: '2025-01-01T00:00:00Z' });
		const c = book({ reviewRating: 5, lastFinishedAt: '2026-02-01T00:00:00Z' });
		const unrated = book();
		expect(favoriteBooks([a, b, unrated, c]).map((x) => x.id)).toEqual([c.id, b.id, a.id]);
		expect(favoriteBooks([a, b, c], 2)).toHaveLength(2);
	});
});

describe('attività recente', () => {
	it('ordina gli eventi dal più recente e rispetta il limite', () => {
		const finished = book({ lastFinishedAt: '2026-03-01T00:00:00Z' });
		const queued = book();
		const items = recentActivity(
			home([finished, queued], {
				queue: [{ position: 1, addedAt: '2026-04-01T00:00:00Z', book: queued }]
			}),
			[{ book: book(), stoppedAtPage: 12, dnfAt: '2026-02-01T00:00:00Z' }],
			2
		);
		expect(items.map((item) => item.kind)).toEqual(['queued', 'finished']);
	});

	it('tempo relativo in italiano', () => {
		const now = new Date(2026, 9, 6, 12);
		expect(relativeTime(new Date(2026, 9, 6, 8).toISOString(), now)).toBe('oggi');
		expect(relativeTime(new Date(2026, 9, 3, 8).toISOString(), now)).toBe('3 giorni fa');
		expect(relativeTime(new Date(2026, 8, 20).toISOString(), now)).toBe('2 settimane fa');
		expect(relativeTime(new Date(2026, 5, 1).toISOString(), now)).toBe('4 mesi fa');
	});
});

describe('calendario', () => {
	const days = [day('2026-01-05', 30), day('2026-01-06', 10), day('2026-03-02', 50)];

	it('somma pagine e giorni per mese', () => {
		expect(pagesByMonth(days).slice(0, 3)).toEqual([40, 0, 50]);
		expect(readingDaysByMonth(days).slice(0, 3)).toEqual([2, 0, 1]);
	});

	it('matrice giorno della settimana x mese (lunedì = 0)', () => {
		const matrix = weekdayMonthMatrix(days);
		expect(matrix[0]?.[0]).toBe(30); // 5 gennaio 2026: lunedì
		expect(matrix[1]?.[0]).toBe(10); // martedì
		expect(matrix[0]?.[2]).toBe(50); // 2 marzo 2026: lunedì
	});

	it('ultimi 7 giorni con oggi in fondo', () => {
		const week = lastSevenDays([day('2026-10-06', 5), day('2026-10-01', 0)], new Date(2026, 9, 6));
		expect(week).toHaveLength(7);
		expect(week[6]).toMatchObject({ key: '2026-10-06', read: true, today: true, label: 'Mar' });
		expect(week[0]).toMatchObject({ key: '2026-09-30', read: false });
		expect(week.find((d) => d.key === '2026-10-01')?.read).toBe(false);
	});
});

describe('quote dei generi', () => {
	it('percentuali sul totale, decrescenti, senza generi vuoti', () => {
		expect(
			genreShares([
				{ slug: 'classics', count: 1 },
				{ slug: 'fantasy-magical-gothic', count: 3 },
				{ slug: 'romance-ya-na', count: 0 }
			])
		).toEqual([
			{ slug: 'fantasy-magical-gothic', count: 3, percent: 75 },
			{ slug: 'classics', count: 1, percent: 25 }
		]);
		expect(genreShares([])).toEqual([]);
	});
});
