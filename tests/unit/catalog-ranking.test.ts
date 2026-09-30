import { describe, expect, it } from 'vitest';
import type { EditionCandidate } from '../../src/lib/contracts/books';
import { dedupeCandidates, identityKeys, mergeCandidates } from '../../src/lib/catalog/merge';
import {
	isStrongIsbnMatch,
	rankCandidates,
	scoreCandidate,
	topCandidates
} from '../../src/lib/catalog/ranking';
import { authorSimilarity, normalizeText, titleSimilarity } from '../../src/lib/catalog/text';
import { parsePublishedDate } from '../../src/lib/catalog/published-date';
import { toIso2, toIso3 } from '../../src/lib/catalog/language';

function candidate(overrides: Partial<EditionCandidate> = {}): EditionCandidate {
	return {
		provider: 'open-library',
		providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: null },
		workTitle: 'Dune',
		editionTitle: 'Dune',
		authors: ['Frank Herbert'],
		isbn10: null,
		isbn13: null,
		language: null,
		publisher: null,
		publishedDate: null,
		pageCount: null,
		coverUrl: null,
		confidence: 0,
		matchReasons: [],
		...overrides
	};
}

describe('testo', () => {
	it('normalizza accenti, maiuscole e punteggiatura', () => {
		expect(normalizeText("L'Éducation sentimentale!")).toBe('l education sentimentale');
		expect(normalizeText('Romeo & Giulietta')).toBe('romeo e giulietta');
	});

	it('similarità titolo: identico > contenuto > diverso', () => {
		expect(titleSimilarity('dune', 'Dune')).toBe(1);
		expect(titleSimilarity('Il nome della rosa', 'Nome della rosa')).toBe(1); // articoli ignorati
		const partial = titleSimilarity('dune', 'Dune. Il ciclo di Dune');
		expect(partial).toBeGreaterThanOrEqual(0.6);
		expect(partial).toBeLessThan(1);
		expect(titleSimilarity('dune', 'Orgoglio e pregiudizio')).toBe(0);
	});

	it('similarità autore: cognome o nome completo', () => {
		expect(authorSimilarity('herbert', ['Frank Herbert'])).toBe(1);
		expect(authorSimilarity('Frank Herbert', ['Brian Herbert', 'Kevin Anderson'])).toBe(0.5);
		expect(authorSimilarity('tolkien', ['Frank Herbert'])).toBe(0);
	});
});

describe('date e lingue', () => {
	it('parsePublishedDate', () => {
		expect(parsePublishedDate('2005')).toEqual({ date: null, year: 2005 });
		expect(parsePublishedDate('2017-05-09')).toEqual({ date: '2017-05-09', year: 2017 });
		expect(parsePublishedDate('Nov 14, 2019')).toEqual({ date: '2019-11-14', year: 2019 });
		expect(parsePublishedDate('August 1, 1978')).toEqual({ date: '1978-08-01', year: 1978 });
		expect(parsePublishedDate('2019-02-31')).toEqual({ date: null, year: 2019 });
		expect(parsePublishedDate('ristampa 1999 riveduta')).toEqual({ date: null, year: 1999 });
		expect(parsePublishedDate('s.d.')).toEqual({ date: null, year: null });
		expect(parsePublishedDate(null)).toEqual({ date: null, year: null });
	});

	it('codici lingua', () => {
		expect(toIso2('ita')).toBe('it');
		expect(toIso2('/languages/eng')).toBe('en');
		expect(toIso2('it-IT')).toBe('it');
		expect(toIso2('')).toBeNull();
		expect(toIso3('it')).toBe('ita');
		expect(toIso3('xx')).toBeNull();
	});
});

describe('ranking (ISBN > titolo > autore > lingua > cover > metadati)', () => {
	const query = { title: 'Dune', author: 'Herbert', language: 'it', isbn13: '9788804678106' };

	it("l'ISBN esatto vince su qualunque altra cosa", () => {
		const exactIsbn = candidate({
			editionTitle: 'Altro titolo',
			workTitle: 'Altro titolo',
			isbn13: '9788804678106'
		});
		const perfectText = candidate({
			language: 'it',
			coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
			pageCount: 600,
			publisher: 'X',
			publishedDate: '2000'
		});
		const [first] = rankCandidates([perfectText, exactIsbn], query);
		expect(first?.isbn13).toBe('9788804678106');
		expect(first?.matchReasons).toContain('isbn-exact');
	});

	it('titolo esatto batte titolo parziale; titolo batte autore', () => {
		const exact = candidate({ editionTitle: 'Dune', workTitle: 'Dune', authors: ['Altri'] });
		const partial = candidate({
			editionTitle: 'Dune. Il ciclo di Dune',
			workTitle: 'Dune. Il ciclo',
			authors: ['Frank Herbert']
		});
		const onlyAuthor = candidate({
			editionTitle: 'Il Messia di Arrakis',
			workTitle: 'Il Messia di Arrakis',
			authors: ['Frank Herbert']
		});
		const order = rankCandidates([onlyAuthor, partial, exact], {
			title: 'Dune',
			author: 'Herbert'
		});
		expect(order.map((c) => c.editionTitle)).toEqual([
			'Dune',
			'Dune. Il ciclo di Dune',
			'Il Messia di Arrakis'
		]);
	});

	it('a parità di testo: lingua, poi cover, poi metadati', () => {
		const base = { title: 'Dune', author: 'Frank Herbert', language: 'it' };
		const italian = candidate({ language: 'it' });
		const coverOnly = candidate({
			language: 'en',
			coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg'
		});
		const metaOnly = candidate({
			language: 'en',
			pageCount: 500,
			publisher: 'Ace',
			publishedDate: '2000'
		});
		const bare = candidate({ language: 'en' });
		const order = rankCandidates([bare, metaOnly, coverOnly, italian], base);
		expect(order[0]).toMatchObject({ language: 'it' });
		expect(order[1]?.coverUrl).not.toBeNull();
		expect(order[2]?.pageCount).toBe(500);
		expect(order[3]).toMatchObject({ pageCount: null, coverUrl: null });
	});

	it('la confidence è 0..1 e le ragioni sono coerenti', () => {
		const { confidence, reasons } = scoreCandidate(
			candidate({
				isbn13: '9788804678106',
				language: 'it',
				coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
				pageCount: 1,
				publisher: 'x',
				publishedDate: '2000'
			}),
			query
		);
		expect(confidence).toBe(1);
		expect(reasons).toEqual([
			'isbn-exact',
			'title-exact',
			'author-match',
			'language-match',
			'has-cover',
			'complete-metadata'
		]);
		expect(
			scoreCandidate(candidate({ editionTitle: 'Zzz', workTitle: 'Zzz', authors: ['Yyy'] }), query)
				.confidence
		).toBeLessThan(0.3);
	});

	it('ordinamento stabile a parità di punteggio', () => {
		const a = candidate({
			editionTitle: 'Dune',
			providerIds: { openLibraryWorkId: 'A', openLibraryEditionId: null, googleBooksId: null }
		});
		const b = candidate({
			editionTitle: 'Dune',
			providerIds: { openLibraryWorkId: 'B', openLibraryEditionId: null, googleBooksId: null }
		});
		expect(
			rankCandidates([a, b], { title: 'Dune' }).map((c) => c.providerIds.openLibraryWorkId)
		).toEqual(['A', 'B']);
	});

	it('mostra al massimo 5 candidati', () => {
		const many = Array.from({ length: 12 }, (_, i) => candidate({ editionTitle: `Dune ${i}` }));
		expect(topCandidates(rankCandidates(many, { title: 'Dune' }))).toHaveLength(5);
		expect(topCandidates(many, 3)).toHaveLength(3);
	});
});

describe('preselezione automatica', () => {
	it('solo con ISBN esatto, mai con titolo + autore identici', () => {
		const sameText = rankCandidates([candidate({ isbn13: '9788804678106' })], {
			title: 'Dune',
			author: 'Frank Herbert'
		});
		expect(isStrongIsbnMatch(sameText, '9780441013593')).toBe(false);
		expect(isStrongIsbnMatch(sameText, '9788804678106')).toBe(true);
	});

	it("riconosce l'ISBN-10 della stessa edizione", () => {
		const ranked = [candidate({ isbn10: '0441013597' })];
		expect(isStrongIsbnMatch(ranked, '9780441013593')).toBe(true);
	});

	it('lista vuota o ISBN non valido: nessuna preselezione', () => {
		expect(isStrongIsbnMatch([], '9780441013593')).toBe(false);
		expect(isStrongIsbnMatch([candidate({ isbn13: '1234567890123' })], '1234567890123')).toBe(
			false
		);
	});
});

describe('dedupe e merge', () => {
	it('fonde solo con ISBN o id provider in comune', () => {
		const ol = candidate({
			isbn13: '9788804678106',
			publisher: 'Mondadori',
			providerIds: { openLibraryWorkId: 'OL1W', openLibraryEditionId: 'OL1M', googleBooksId: null }
		});
		const gb = candidate({
			provider: 'google-books',
			isbn13: '9788804678106',
			pageCount: 688,
			coverUrl: 'https://books.google.com/books/content?id=x',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: 'GB1' }
		});
		const merged = dedupeCandidates([ol, gb]);
		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({
			provider: 'open-library', // priorità di chi arriva prima
			publisher: 'Mondadori',
			pageCount: 688,
			coverUrl: 'https://books.google.com/books/content?id=x',
			providerIds: { openLibraryWorkId: 'OL1W', openLibraryEditionId: 'OL1M', googleBooksId: 'GB1' }
		});
	});

	it('titolo + autore identici NON bastano: due edizioni senza ISBN in comune restano due', () => {
		const a = candidate({
			isbn13: '9788804678106',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: 'OL1M', googleBooksId: null }
		});
		const b = candidate({
			provider: 'google-books',
			isbn13: '9780441013593',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: 'GB2' }
		});
		const c = candidate({
			provider: 'google-books',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: 'GB3' }
		});
		const d = candidate({
			providerIds: { openLibraryWorkId: 'OL2W', openLibraryEditionId: null, googleBooksId: null }
		});
		expect(dedupeCandidates([a, b, c, d])).toHaveLength(4);
	});

	it('ISBN-10 e ISBN-13 della stessa edizione coincidono', () => {
		const a = candidate({ isbn10: '0441013597' });
		const b = candidate({ provider: 'google-books', isbn13: '9780441013593' });
		expect(identityKeys(a)).toEqual(identityKeys(b));
		expect(dedupeCandidates([a, b])).toHaveLength(1);
	});

	it('stesso id provider duplicato nello stesso elenco', () => {
		const a = candidate({
			provider: 'google-books',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: 'GB1' }
		});
		expect(dedupeCandidates([a, { ...a }])).toHaveLength(1);
	});

	it('mergeCandidates non perde i campi del secondario', () => {
		const merged = mergeCandidates(
			candidate({ pageCount: null }),
			candidate({ pageCount: 300, publisher: 'P' })
		);
		expect(merged.pageCount).toBe(300);
		expect(merged.publisher).toBe('P');
	});
});
