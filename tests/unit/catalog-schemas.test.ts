import { describe, expect, it } from 'vitest';
import {
	addBookRequestSchema,
	coverSelectRequestSchema,
	catalogSearchQuerySchema
} from '../../src/lib/catalog/schemas';
import {
	buildAddRequest,
	candidateMeta,
	draftFromCandidate,
	draftWithEdition,
	seriesLabel
} from '../../src/lib/catalog/draft';
import type { EditionCandidate } from '../../src/lib/contracts/books';
import type { BookInfo } from '../../src/lib/catalog/book-info';

it('ricerca: accetta solo gli ordini supportati, con sort facoltativo', () => {
	expect(catalogSearchQuerySchema.parse({ title: 'Dune' }).sort).toBeUndefined();
	for (const sort of ['relevance', 'newest']) {
		expect(catalogSearchQuerySchema.parse({ title: 'Dune', sort }).sort).toBe(sort);
	}
	expect(catalogSearchQuerySchema.safeParse({ title: 'Dune', sort: 'oldest' }).success).toBe(false);
	expect(catalogSearchQuerySchema.safeParse({ title: 'Dune', sort: '' }).success).toBe(false);
});

const manual = {
	source: 'manual',
	title: 'Il nome della rosa',
	author: 'Umberto Eco',
	pageCount: 541,
	language: 'it',
	isbn: null,
	genre: 'classics',
	format: 'physical',
	series: null,
	coverUrl: null,
	edition: null
} as const;

describe('addBookRequestSchema', () => {
	it('accetta un inserimento manuale senza ISBN né rete', () => {
		const parsed = addBookRequestSchema.parse(manual);
		expect(parsed.force).toBe(false);
	});

	it('richiede genere e formato validi', () => {
		expect(addBookRequestSchema.safeParse({ ...manual, genre: 'noir' }).success).toBe(false);
		expect(addBookRequestSchema.safeParse({ ...manual, format: 'audio' }).success).toBe(false);
		expect(addBookRequestSchema.safeParse({ ...manual, title: '   ' }).success).toBe(false);
	});

	it("valida il checksum dell'ISBN se presente", () => {
		expect(addBookRequestSchema.safeParse({ ...manual, isbn: '978-88-04-66803-9' }).success).toBe(
			true
		);
		expect(addBookRequestSchema.safeParse({ ...manual, isbn: '9788804668038' }).success).toBe(
			false
		);
	});

	it('serie: il volume non supera il totale', () => {
		const series = (number: number | null, total: number | null) => ({
			...manual,
			series: { name: 'Dune', number, total }
		});
		expect(addBookRequestSchema.safeParse(series(2, 6)).success).toBe(true);
		expect(addBookRequestSchema.safeParse(series(1.5, 6)).success).toBe(true);
		expect(addBookRequestSchema.safeParse(series(7, 6)).success).toBe(false);
		expect(addBookRequestSchema.safeParse(series(null, 6)).success).toBe(true);
		expect(addBookRequestSchema.safeParse(series(0, 6)).success).toBe(false);
	});

	it('serie: il numero del volume rispetta la precisione del database', () => {
		const series = (number: number) => ({
			...manual,
			series: { name: 'Dune', number, total: 6 }
		});
		expect(addBookRequestSchema.safeParse(series(1.23)).success).toBe(true);
		expect(addBookRequestSchema.safeParse(series(1.234)).success).toBe(false);
	});

	it('cover solo da host dei provider', () => {
		expect(
			addBookRequestSchema.safeParse({
				...manual,
				coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg'
			}).success
		).toBe(true);
		expect(
			addBookRequestSchema.safeParse({ ...manual, coverUrl: 'https://evil.example.com/a.jpg' })
				.success
		).toBe(false);
		expect(
			addBookRequestSchema.safeParse({ ...manual, coverUrl: 'http://169.254.169.254/latest' })
				.success
		).toBe(false);
	});

	it('coerenza fra source ed edition', () => {
		const edition = {
			provider: 'google-books',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: 'x' },
			workTitle: 'Dune',
			authors: ['Frank Herbert'],
			publisher: null,
			publishedDate: null
		};
		expect(addBookRequestSchema.safeParse({ ...manual, source: 'manual', edition }).success).toBe(
			false
		);
		expect(
			addBookRequestSchema.safeParse({ ...manual, source: 'search', edition: null }).success
		).toBe(false);
		expect(addBookRequestSchema.safeParse({ ...manual, source: 'search', edition }).success).toBe(
			true
		);
		expect(addBookRequestSchema.safeParse({ ...manual, source: 'import' }).success).toBe(false);
	});

	it('limiti sui campi (nessun payload enorme)', () => {
		expect(addBookRequestSchema.safeParse({ ...manual, title: 'x'.repeat(301) }).success).toBe(
			false
		);
		expect(addBookRequestSchema.safeParse({ ...manual, pageCount: 0 }).success).toBe(false);
		expect(addBookRequestSchema.safeParse({ ...manual, pageCount: 1.5 }).success).toBe(false);
	});
});

describe('coverSelectRequestSchema', () => {
	const id = '3f2b2e9e-0000-4000-8000-000000000001';
	it('valida azioni e URL', () => {
		expect(
			coverSelectRequestSchema.safeParse({ action: 'remove-custom', bookId: id }).success
		).toBe(true);
		expect(
			coverSelectRequestSchema.safeParse({
				action: 'provider',
				bookId: id,
				coverUrl: 'https://books.google.com/books/content?id=1'
			}).success
		).toBe(true);
		expect(
			coverSelectRequestSchema.safeParse({
				action: 'provider',
				bookId: id,
				coverUrl: 'https://evil.example.com/x.jpg'
			}).success
		).toBe(false);
		expect(
			coverSelectRequestSchema.safeParse({
				action: 'provider',
				bookId: 'non-uuid',
				coverUrl: 'https://books.google.com/x'
			}).success
		).toBe(false);
	});
});

describe('bozza libro', () => {
	const candidate: EditionCandidate = {
		provider: 'open-library',
		providerIds: { openLibraryWorkId: 'OL1W', openLibraryEditionId: 'OL1M', googleBooksId: null },
		workTitle: 'Dune',
		editionTitle: 'Dune. Il ciclo di Dune',
		authors: ['Frank Herbert', 'Sandro Sandrelli'],
		isbn10: '8834739671',
		isbn13: '9788834739679',
		language: 'it',
		publisher: 'Fanucci',
		publishedDate: 'Nov 14, 2019',
		pageCount: 640,
		coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
		confidence: 0.9,
		matchReasons: []
	};

	it('dal candidato alla richiesta di aggiunta', () => {
		const draft = draftFromCandidate(candidate, 'isbn');
		const request = buildAddRequest(draft, {
			genre: 'dystopia-scifi',
			format: 'digital',
			series: { name: 'Ciclo di Dune', number: 1, total: 6 }
		});
		expect(addBookRequestSchema.safeParse(request).success).toBe(true);
		expect(request).toMatchObject({
			source: 'isbn',
			title: 'Dune. Il ciclo di Dune',
			author: 'Frank Herbert, Sandro Sandrelli',
			isbn: '9788834739679',
			force: false
		});
	});

	it('etichette', () => {
		expect(candidateMeta(candidate)).toBe('Fanucci · 2019 · 640 pag. · Italiano');
		expect(seriesLabel(2, 3)).toBe('Vol. 2 di 3');
		expect(seriesLabel(2, null)).toBe('Vol. 2');
		expect(seriesLabel(null, 3)).toBeNull();
	});

	it('cambiando edizione sostituisce i dati del volume anche quando non sono disponibili', () => {
		const edition: BookInfo['editions'][number] = {
			title: 'Dune',
			publisher: null,
			year: null,
			language: null,
			pages: null,
			isbn13: null,
			coverUrl: null,
			url: 'https://openlibrary.org/books/OL2M'
		};
		const draft = draftWithEdition(
			draftFromCandidate(candidate, 'search'),
			edition,
			'https://openlibrary.org/works/OL1W'
		);
		const request = buildAddRequest(draft, {
			genre: 'dystopia-scifi',
			format: 'physical',
			series: null
		});

		expect(draft).toMatchObject({
			title: 'Dune',
			pageCount: null,
			language: null,
			isbn: null,
			coverUrl: null,
			publisher: null,
			publishedDate: null,
			edition: {
				providerIds: { openLibraryWorkId: 'OL1W', openLibraryEditionId: 'OL2M' },
				publisher: null,
				publishedDate: null
			}
		});
		expect(request.pageCount).toBeNull();
		expect(request.coverUrl).toBeNull();
		expect(addBookRequestSchema.safeParse(request).success).toBe(true);
	});

	it('cambiando edizione usa i nuovi dati mantenendo il collegamento all’opera', () => {
		const edition: BookInfo['editions'][number] = {
			title: 'Dune',
			publisher: 'Ace',
			year: 2025,
			language: 'en',
			pages: 688,
			isbn13: '9780140328721',
			coverUrl: 'https://covers.openlibrary.org/b/id/2-M.jpg',
			url: 'https://openlibrary.org/books/OL2M'
		};
		const draft = draftWithEdition(
			draftFromCandidate(candidate, 'search'),
			edition,
			'https://openlibrary.org/works/OL1W'
		);

		expect(draft).toMatchObject({
			title: 'Dune',
			pageCount: 688,
			language: 'en',
			isbn: edition.isbn13,
			coverUrl: 'https://covers.openlibrary.org/b/id/2-L.jpg',
			publisher: 'Ace',
			publishedDate: '2025',
			edition: {
				workTitle: 'Dune',
				authors: candidate.authors,
				providerIds: {
					openLibraryWorkId: 'OL1W',
					openLibraryEditionId: 'OL2M',
					googleBooksId: null
				},
				publisher: 'Ace',
				publishedDate: '2025'
			}
		});
	});
});
