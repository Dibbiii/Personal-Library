import { describe, expect, it } from 'vitest';
import {
	matchesQuery,
	normalizeQuery,
	sortBooks
} from '../../src/lib/components/library/library-filter';
import type { BookSummary } from '../../src/lib/contracts';

function book(title: string, author: string, reviewRating: number | null = null): BookSummary {
	return {
		id: `00000000-0000-4000-8000-${title.length.toString().padStart(12, '0')}`,
		editionId: null,
		title,
		author,
		pageCount: 300,
		language: 'it',
		format: 'physical',
		source: 'manual',
		genre: { id: 1, slug: 'classics', name: 'Classici' },
		series: null,
		lifecycleState: 'unread',
		completedReadingsCount: 0,
		reviewRating,
		lastFinishedAt: null,
		lastActivityAt: null,
		cover: { coverUrl: null, coverStoragePath: null }
	};
}

describe('library-filter', () => {
	it('cerca in titolo, autore e genere senza accenti né maiuscole', () => {
		const odissea = book('Odissèa', 'Omero');
		expect(matchesQuery(odissea, normalizeQuery('ODISSEA'))).toBe(true);
		expect(matchesQuery(odissea, normalizeQuery('omer'))).toBe(true);
		expect(matchesQuery(odissea, normalizeQuery('classici'))).toBe(true);
		expect(matchesQuery(odissea, normalizeQuery('dune'))).toBe(false);
		expect(matchesQuery(odissea, '')).toBe(true);
	});

	it('ordina per titolo, autore e voto senza mutare l’input', () => {
		const books = [
			book('Zanna Bianca', 'London', 3),
			book('Anna Karenina', 'Tolstoj'),
			book('Emma', 'Austen', 5)
		];
		expect(sortBooks(books, 'recent')).toEqual(books);
		expect(sortBooks(books, 'title').map((b) => b.title)).toEqual([
			'Anna Karenina',
			'Emma',
			'Zanna Bianca'
		]);
		expect(sortBooks(books, 'author').map((b) => b.author)).toEqual([
			'Austen',
			'London',
			'Tolstoj'
		]);
		expect(sortBooks(books, 'rating').map((b) => b.title)).toEqual([
			'Emma',
			'Zanna Bianca',
			'Anna Karenina'
		]);
		expect(books[0]?.title).toBe('Zanna Bianca');
	});
});
