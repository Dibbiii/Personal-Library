import { describe, expect, it } from 'vitest';
import type { BookSummary } from '../../src/lib/contracts';
import { sortTbr } from '../../src/lib/components/genre/tbr';
import { matchesWheelFormat, wheelFormatCounts } from '../../src/lib/explore/wheel-filter';

function book(overrides: Partial<BookSummary> & Pick<BookSummary, 'id' | 'title'>): BookSummary {
	const { id, title, ...rest } = overrides;
	return {
		id,
		editionId: null,
		title,
		author: 'Mario Rossi',
		pageCount: null,
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
		...rest
	};
}

describe('ordinamento TBR', () => {
	const books = [
		book({ id: '11111111-1111-4111-8111-111111111111', title: 'Zeta', author: 'Ada Bianchi', pageCount: 300 }),
		book({ id: '22222222-2222-4222-8222-222222222222', title: 'Alfa', author: 'Zeno Alberti', pageCount: 120 })
	];

	it('ordina per titolo, autore o pagine senza dipendere dal voto', () => {
		expect(sortTbr(books, 'title').map((item) => item.title)).toEqual(['Alfa', 'Zeta']);
		expect(sortTbr(books, 'author').map((item) => item.author)).toEqual(['Zeno Alberti', 'Ada Bianchi']);
		expect(sortTbr(books, 'pages').map((item) => item.pageCount)).toEqual([120, 300]);
	});
});

describe('filtro formato della ruota', () => {
	const books = [
		book({ id: '11111111-1111-4111-8111-111111111111', title: 'Carta', format: 'physical' }),
		book({ id: '22222222-2222-4222-8222-222222222222', title: 'Ebook', format: 'digital' }),
		book({ id: '33333333-3333-4333-8333-333333333333', title: 'Entrambi', format: 'both' })
	];

	it('include "entrambi" sia nei cartacei sia nei digitali', () => {
		expect(books.filter((item) => matchesWheelFormat(item, 'physical')).map((item) => item.title)).toEqual([
			'Carta',
			'Entrambi'
		]);
		expect(books.filter((item) => matchesWheelFormat(item, 'digital')).map((item) => item.title)).toEqual([
			'Ebook',
			'Entrambi'
		]);
		expect(wheelFormatCounts(books)).toEqual({ all: 3, physical: 2, digital: 2 });
	});
});
