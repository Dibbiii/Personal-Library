import { describe, expect, it } from 'vitest';
import { addBookRequestSchema, coverSelectRequestSchema } from '../../src/lib/catalog/schemas';
import {
	buildAddRequest,
	candidateMeta,
	draftFromCandidate,
	seriesLabel
} from '../../src/lib/catalog/draft';
import type { EditionCandidate } from '../../src/lib/contracts/books';

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
});
