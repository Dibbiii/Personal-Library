import { describe, expect, it } from 'vitest';
import { discoverQuerySchema, findOwned, ownedKey } from '../../src/lib/catalog/discover';
import { buildDiscoverSearch, parseDiscoverDoc } from '../../src/lib/server/catalog/discover';

const query = (input: Record<string, string> = {}) => discoverQuerySchema.parse(input);

describe('buildDiscoverSearch', () => {
	it('ricerca semplice: testo e lingua, ordinamento per rilevanza', () => {
		expect(buildDiscoverSearch(query({ q: 'Il nome della rosa' }), 2026)).toEqual({
			q: '(title:(Il nome della rosa) OR author:(Il nome della rosa) OR publisher:(Il nome della rosa)) language:ita',
			sort: 'relevance'
		});
	});

	it('temi, voto minimo e anni diventano filtri Solr', () => {
		const { q } = buildDiscoverSearch(
			query({ topics: 'fantasy,scifi', minRating: '4', from: '1950', to: '2000', lang: 'all' }),
			2026
		);
		expect(q).toBe(
			'subject:(fantasy OR "science fiction") ratings_average:[4 TO *] first_publish_year:[1950 TO 2000]'
		);
	});

	it('gli estremi del cursore degli anni non filtrano', () => {
		const { q } = buildDiscoverSearch(query({ from: '1800', to: '2026', lang: 'all' }), 2026);
		expect(q).toBe('ratings_count:[1 TO *]');
	});

	it('le sezioni hanno il loro ordinamento e i loro vincoli', () => {
		expect(buildDiscoverSearch(query({ section: 'new' }), 2026)).toEqual({
			q: 'first_publish_year:[2024 TO 2026] language:ita',
			sort: 'trending'
		});
		expect(buildDiscoverSearch(query({ section: 'classics' }), 2026).sort).toBe('rating');
		expect(buildDiscoverSearch(query({ section: 'popular' }), 2026).sort).toBe('readinglog');
		expect(buildDiscoverSearch(query({ section: 'recommended' }), 2026).q).toContain(
			'ratings_count:[20 TO *]'
		);
	});

	it('toglie i caratteri speciali dal testo e cerca in tutti i metadati testuali', () => {
		expect(buildDiscoverSearch(query({ q: 'dune) OR (x:*', lang: 'all' }), 2026).q).toBe(
			'(title:(dune OR x) OR author:(dune OR x) OR publisher:(dune OR x))'
		);
	});

	it('rifiuta temi sconosciuti', () => {
		expect(() => query({ topics: 'fantasy,nope' })).toThrow();
	});
});

describe('parseDiscoverDoc', () => {
	const doc = {
		key: '/works/OL1W',
		title: 'Nineteen Eighty-Four',
		author_name: ['George Orwell'],
		first_publish_year: 1949,
		cover_i: 1,
		ratings_average: 4.278,
		ratings_count: 428,
		editions: { docs: [{ key: '/books/OL2M', title: '1984', cover_i: 2, language: ['ita'] }] }
	};

	it("preferisce titolo e copertina dell'edizione nella lingua scelta", () => {
		expect(parseDiscoverDoc(doc, 'it')).toEqual({
			workId: 'OL1W',
			editionId: 'OL2M',
			title: '1984',
			workTitle: 'Nineteen Eighty-Four',
			authors: ['George Orwell'],
			year: 1949,
			coverUrl: 'https://covers.openlibrary.org/b/id/2-M.jpg',
			rating: 4.3,
			ratingCount: 428,
			language: 'it'
		});
	});

	it("senza lingua resta il titolo dell'opera", () => {
		const book = parseDiscoverDoc(doc, 'all');
		expect(book?.title).toBe('Nineteen Eighty-Four');
		expect(book?.editionId).toBeNull();
		expect(book?.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-M.jpg');
	});

	it('scarta documenti non validi', () => {
		expect(parseDiscoverDoc({ title: 'x' }, 'it')).toBeNull();
	});
});

describe('findOwned', () => {
	it("riconosce un libro in libreria dal titolo dell'opera o dell'edizione", () => {
		const owned = new Map([[ownedKey('1984', 'George Orwell'), 'book-1']]);
		const book = parseDiscoverDoc(
			{ key: '/works/OL1W', title: 'Nineteen Eighty-Four', author_name: ['George Orwell'] },
			'all'
		);
		expect(book && findOwned({ ...book, title: '1984' }, owned)).toBe('book-1');
		expect(book && findOwned(book, owned)).toBeNull();
	});
});
