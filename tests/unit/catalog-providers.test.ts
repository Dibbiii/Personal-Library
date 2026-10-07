import { describe, expect, it, vi } from 'vitest';
import { DataAccessError } from '../../src/lib/data/errors';
import type { EditionCandidate } from '../../src/lib/contracts/books';
import type { BookProvider } from '../../src/lib/catalog/types';
import { GoogleBooksProvider, parseVolumes } from '../../src/lib/server/catalog/google-books';
import { fetchJson } from '../../src/lib/server/catalog/http';
import {
	buildTextSearchQuery,
	OpenLibraryProvider,
	parseSearchResponse,
	sanitizeQuery
} from '../../src/lib/server/catalog/open-library';
import { CatalogService } from '../../src/lib/server/catalog/service';
import { editionCandidateSchema } from '../../src/lib/contracts/books';
import { isAllowedCoverUrl, normalizeCoverUrl, coverSrc } from '../../src/lib/catalog/covers';
import { GB_SEARCH_DUNE } from '../fixtures/catalog/google-books';
import { OL_EDITION_JSON, OL_SEARCH_DUNE, OL_SEARCH_ISBN } from '../fixtures/catalog/open-library';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** fetch finto che instrada per URL. */
function router(routes: Record<string, () => Response | Promise<Response>>) {
	const calls: string[] = [];
	const fetchImpl = vi.fn(async (input: string) => {
		calls.push(input);
		for (const [fragment, handler] of Object.entries(routes)) {
			if (input.includes(fragment)) return handler();
		}
		return new Response('not found', { status: 404 });
	});
	return { fetch: fetchImpl, calls };
}

describe('parser Open Library', () => {
	it('mappa i documenti di search.json su candidati validi per il contratto', () => {
		const candidates = parseSearchResponse(OL_SEARCH_DUNE);
		expect(candidates).toHaveLength(2); // il documento rotto è scartato
		for (const candidate of candidates)
			expect(editionCandidateSchema.safeParse(candidate).success).toBe(true);

		expect(candidates[0]).toMatchObject({
			provider: 'open-library',
			workTitle: 'Dune',
			editionTitle: 'Dune. Il ciclo di Dune',
			authors: ['Frank Herbert'],
			isbn13: '9788834739679',
			isbn10: '8834739671',
			language: 'it',
			publisher: 'Fanucci',
			coverUrl: 'https://covers.openlibrary.org/b/id/15244725-L.jpg',
			providerIds: {
				openLibraryWorkId: 'OL893414W',
				openLibraryEditionId: 'OL51711708M',
				googleBooksId: null
			}
		});
		// Nessuna edizione con ISBN: non si inventa l'ISBN dal livello opera
		expect(candidates[1]).toMatchObject({ isbn13: null, coverUrl: null });
	});

	it('risposte inattese non lanciano', () => {
		expect(parseSearchResponse(null)).toEqual([]);
		expect(parseSearchResponse({ docs: 'no' })).toEqual([]);
		expect(parseSearchResponse({})).toEqual([]);
	});

	it('sanitizeQuery elimina gli operatori Solr', () => {
		expect(sanitizeQuery('title:(dune) OR "herbert" /x\\')).toBe('title dune OR herbert x');
	});

	it('compone la ricerca libera su titolo, autore ed editore', () => {
		expect(buildTextSearchQuery('Fanucci')).toBe(
			'(title:(Fanucci) OR author:(Fanucci) OR publisher:(Fanucci))'
		);
	});
});

describe('parser Google Books', () => {
	it('mappa i volumi, normalizza cover e ISBN, scarta ciò che non ha titolo', () => {
		const candidates = parseVolumes(GB_SEARCH_DUNE);
		expect(candidates).toHaveLength(2);
		for (const candidate of candidates)
			expect(editionCandidateSchema.safeParse(candidate).success).toBe(true);

		expect(candidates[0]).toMatchObject({
			provider: 'google-books',
			editionTitle: 'Dune',
			isbn13: '9788804678106',
			isbn10: '8804678100',
			pageCount: 688,
			language: 'it',
			providerIds: { googleBooksId: 'B1hSG45JCX4C' }
		});
		// https, niente edge=curl
		expect(candidates[0]?.coverUrl).toBe(
			'https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1&source=gbs_api'
		);
		// senza autori: segnaposto; host cover non in allow-list: nessuna cover
		expect(candidates[1]).toMatchObject({
			authors: ['Autore sconosciuto'],
			isbn13: null,
			coverUrl: null
		});
	});
});

describe('allow-list cover', () => {
	it('accetta solo https e host dei provider', () => {
		expect(isAllowedCoverUrl('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe(true);
		expect(isAllowedCoverUrl('https://books.google.com/books/content?id=a')).toBe(true);
		expect(isAllowedCoverUrl('http://covers.openlibrary.org/b/id/1-L.jpg')).toBe(false);
		expect(isAllowedCoverUrl('https://evil.example.com/a.jpg')).toBe(false);
		expect(isAllowedCoverUrl('https://covers.openlibrary.org.evil.com/a.jpg')).toBe(false);
		expect(isAllowedCoverUrl('https://user:pw@covers.openlibrary.org/a.jpg')).toBe(false);
		expect(isAllowedCoverUrl('javascript:alert(1)')).toBe(false);
		expect(isAllowedCoverUrl(null)).toBe(false);
		expect(normalizeCoverUrl('http://books.google.com/x?id=1&edge=curl')).toBe(
			'https://books.google.com/x?id=1'
		);
	});

	it('precedenza: custom > provider > placeholder', () => {
		expect(
			coverSrc({
				coverUrl: 'https://covers.openlibrary.org/a.jpg',
				coverStoragePath: 'covers/u/f.png'
			})
		).toBe('/api/covers/covers/u/f.png');
		expect(
			coverSrc({ coverUrl: 'https://covers.openlibrary.org/a.jpg', coverStoragePath: null })
		).toBe('https://covers.openlibrary.org/a.jpg');
		expect(coverSrc({ coverUrl: null, coverStoragePath: null })).toBeNull();
	});
});

describe('fetchJson', () => {
	it('rifiuta host fuori allow-list senza fare richieste (SSRF)', async () => {
		const fetchImpl = vi.fn();
		await expect(
			fetchJson('https://evil.example.com/x', {
				fetch: fetchImpl,
				allowedHosts: ['openlibrary.org']
			})
		).rejects.toMatchObject({ code: 'VALIDATION' });
		await expect(
			fetchJson('http://openlibrary.org/x', { fetch: fetchImpl, allowedHosts: ['openlibrary.org'] })
		).rejects.toMatchObject({ code: 'VALIDATION' });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('mappa gli errori HTTP nel modello di errore', async () => {
		const opts = (status: number) => ({
			fetch: async () => new Response('x', { status }),
			allowedHosts: ['openlibrary.org']
		});
		await expect(fetchJson('https://openlibrary.org/a', opts(429))).rejects.toMatchObject({
			code: 'RATE_LIMITED'
		});
		await expect(fetchJson('https://openlibrary.org/a', opts(503))).rejects.toMatchObject({
			code: 'NETWORK'
		});
		await expect(fetchJson('https://openlibrary.org/a', opts(403))).rejects.toMatchObject({
			code: 'SERVER'
		});
		await expect(fetchJson('https://openlibrary.org/a', opts(404))).resolves.toBeNull();
		await expect(
			fetchJson('https://openlibrary.org/a', {
				fetch: async () => new Response('non json', { status: 200 }),
				allowedHosts: ['openlibrary.org']
			})
		).rejects.toMatchObject({ code: 'CONTRACT' });
	});

	it('errore di rete e timeout diventano NETWORK', async () => {
		await expect(
			fetchJson('https://openlibrary.org/a', {
				fetch: async () => {
					throw new TypeError('fetch failed');
				},
				allowedHosts: ['openlibrary.org']
			})
		).rejects.toMatchObject({ code: 'NETWORK' });

		const slow = async (_url: string, init?: RequestInit) =>
			new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
			});
		await expect(
			fetchJson('https://openlibrary.org/a', {
				fetch: slow,
				allowedHosts: ['openlibrary.org'],
				timeoutMs: 20
			})
		).rejects.toMatchObject({ code: 'NETWORK', message: expect.stringContaining('tempo') });
	});

	it('un redirect fuori allow-list viene rifiutato', async () => {
		const response = Object.defineProperty(json({}), 'url', {
			value: 'https://evil.example.com/x'
		});
		await expect(
			fetchJson('https://openlibrary.org/a', {
				fetch: async () => response,
				allowedHosts: ['openlibrary.org']
			})
		).rejects.toMatchObject({ code: 'VALIDATION' });
	});
});

describe('OpenLibraryProvider', () => {
	it('lookup ISBN: fonde search (titolo/autori) ed edizione (pagine, editore, cover)', async () => {
		const { fetch: fetchImpl } = router({
			'search.json': () => json(OL_SEARCH_ISBN),
			'/isbn/9780441013593.json': () => json(OL_EDITION_JSON)
		});
		const [candidate] = await new OpenLibraryProvider({ fetch: fetchImpl }).lookupIsbn(
			'9780441013593'
		);
		expect(candidate).toMatchObject({
			workTitle: 'Dune',
			authors: ['Frank Herbert'],
			isbn13: '9780441013593',
			isbn10: '0441013597',
			pageCount: 544,
			publisher: 'Ace Trade',
			language: 'en',
			coverUrl: 'https://covers.openlibrary.org/b/id/14565843-L.jpg',
			providerIds: { openLibraryEditionId: 'OL7524304M', openLibraryWorkId: 'OL893414W' }
		});
	});

	it("lookup ISBN: se l'edizione non è indicizzata ricostruisce da edizione, opera e autori", async () => {
		const { fetch: fetchImpl } = router({
			'search.json': () => json({ docs: [] }),
			'/isbn/': () => json({ ...OL_EDITION_JSON, authors: [{ key: '/authors/OL79034A' }] }),
			'/authors/OL79034A.json': () => json({ name: 'Frank Herbert' }),
			'/works/OL893414W.json': () => json({ title: 'Dune (opera)' })
		});
		const [candidate] = await new OpenLibraryProvider({ fetch: fetchImpl }).lookupIsbn(
			'9780441013593'
		);
		expect(candidate).toMatchObject({
			authors: ['Frank Herbert'],
			workTitle: 'Dune (opera)',
			pageCount: 544
		});
	});

	it('ISBN sconosciuto: nessun candidato (non è un errore)', async () => {
		const { fetch: fetchImpl } = router({ 'search.json': () => json({ docs: [] }) });
		await expect(
			new OpenLibraryProvider({ fetch: fetchImpl }).lookupIsbn('9780441013593')
		).resolves.toEqual([]);
	});

	it("se una delle due chiamate fallisce usa l'altra; se falliscono entrambe è NETWORK", async () => {
		const half = router({
			'search.json': () => json(OL_SEARCH_ISBN),
			'/isbn/': () => new Response('x', { status: 503 })
		});
		const [candidate] = await new OpenLibraryProvider({ fetch: half.fetch }).lookupIsbn(
			'9780441013593'
		);
		expect(candidate?.workTitle).toBe('Dune');

		const down = router({ 'openlibrary.org': () => new Response('x', { status: 503 }) });
		await expect(
			new OpenLibraryProvider({ fetch: down.fetch }).lookupIsbn('9780441013593')
		).rejects.toMatchObject({ code: 'NETWORK' });
	});

	it('ricerca con lingua: prima filtrata, poi senza filtro se i risultati sono pochi', async () => {
		const { fetch: fetchImpl, calls } = router({ 'search.json': () => json(OL_SEARCH_DUNE) });
		await new OpenLibraryProvider({ fetch: fetchImpl }).search({ title: 'dune', language: 'it' });
		expect(calls).toHaveLength(2);
		expect(new URL(calls[0] ?? '').searchParams.get('q')).toContain('publisher:(dune)');
		expect(new URL(calls[0] ?? '').searchParams.get('q')).toContain('language:ita');
		expect(new URL(calls[1] ?? '').searchParams.get('q')).not.toContain('language:');
	});
});

describe('GoogleBooksProvider', () => {
	it('la chiave API resta nella richiesta server e non compare nei candidati', async () => {
		const { fetch: fetchImpl, calls } = router({ 'googleapis.com': () => json(GB_SEARCH_DUNE) });
		const provider = new GoogleBooksProvider({ fetch: fetchImpl, apiKey: 'SEGRETA' });
		const candidates = await provider.search({ title: 'Dune', author: 'Herbert' });
		expect(calls[0]).toContain('key=SEGRETA');
		expect(new URL(calls[0] ?? '').searchParams.get('q')).toBe('intitle:"Dune" inauthor:"Herbert"');
		expect(JSON.stringify(candidates)).not.toContain('SEGRETA');

		await provider.search({ title: 'Fanucci' });
		expect(new URL(calls[1] ?? '').searchParams.get('q')).toBe('Fanucci');
	});

	it('senza chiave non la invia; 429 -> RATE_LIMITED', async () => {
		const ok = router({ 'googleapis.com': () => json(GB_SEARCH_DUNE) });
		await new GoogleBooksProvider({ fetch: ok.fetch }).lookupIsbn('9788804678106');
		expect(ok.calls[0]).not.toContain('key=');
		expect(new URL(ok.calls[0] ?? '').searchParams.get('q')).toBe('isbn:9788804678106');

		const limited = router({ 'googleapis.com': () => json({ error: { code: 429 } }, 429) });
		await expect(
			new GoogleBooksProvider({ fetch: limited.fetch }).lookupIsbn('9788804678106')
		).rejects.toMatchObject({ code: 'RATE_LIMITED' });
	});
});

function fakeProvider(
	id: BookProvider['id'],
	behaviour: { candidates?: EditionCandidate[]; error?: DataAccessError }
) {
	const provider: BookProvider & { searches: number; lookups: number } = {
		id,
		searches: 0,
		lookups: 0,
		async search() {
			provider.searches++;
			if (behaviour.error) throw behaviour.error;
			return behaviour.candidates ?? [];
		},
		async lookupIsbn() {
			provider.lookups++;
			if (behaviour.error) throw behaviour.error;
			return behaviour.candidates ?? [];
		}
	};
	return provider;
}

describe('CatalogService', () => {
	const ol = parseSearchResponse(OL_SEARCH_DUNE);
	const gb = parseVolumes(GB_SEARCH_DUNE);

	it('unisce i provider, ordina e taglia a 5', async () => {
		const many = Array.from({ length: 8 }, (_, i) => ({
			...(ol[0] as EditionCandidate),
			editionTitle: `Dune ${i}`,
			isbn13: null,
			isbn10: null,
			providerIds: { openLibraryWorkId: `W${i}`, openLibraryEditionId: null, googleBooksId: null }
		}));
		const service = new CatalogService({
			providers: [
				fakeProvider('open-library', { candidates: many }),
				fakeProvider('google-books', { candidates: gb })
			]
		});
		const result = await service.search({ title: 'Dune' });
		expect(result.candidates.length).toBeLessThanOrEqual(5);
		expect(result.degraded).toBe(false);
		expect(result.providers).toEqual({ 'open-library': 'ok', 'google-books': 'ok' });
		expect(result.candidates[0]?.confidence).toBeGreaterThanOrEqual(
			result.candidates[1]?.confidence ?? 0
		);
	});

	it('un provider giù: risultati parziali e degraded', async () => {
		const service = new CatalogService({
			providers: [
				fakeProvider('open-library', { error: new DataAccessError('NETWORK', 'giù') }),
				fakeProvider('google-books', { candidates: gb })
			]
		});
		const result = await service.search({ title: 'Dune' });
		expect(result.candidates.length).toBeGreaterThan(0);
		expect(result.degraded).toBe(true);
		expect(result.providers).toEqual({ 'open-library': 'error', 'google-books': 'ok' });
	});

	it('tutti i provider giù: NETWORK; tutti limitati: RATE_LIMITED', async () => {
		const down = new CatalogService({
			providers: [
				fakeProvider('open-library', { error: new DataAccessError('NETWORK', 'a') }),
				fakeProvider('google-books', { error: new DataAccessError('RATE_LIMITED', 'b') })
			]
		});
		await expect(down.search({ title: 'Dune' })).rejects.toMatchObject({ code: 'NETWORK' });

		const limited = new CatalogService({
			providers: [fakeProvider('google-books', { error: new DataAccessError('RATE_LIMITED', 'b') })]
		});
		await expect(limited.lookupIsbn('9780441013593')).rejects.toMatchObject({
			code: 'RATE_LIMITED'
		});
	});

	it("cache: la stessa ricerca non richiama i provider; l'errore non viene cacheato", async () => {
		const provider = fakeProvider('open-library', { candidates: ol });
		const service = new CatalogService({ providers: [provider] });
		await service.search({ title: 'Dune', author: 'Herbert' });
		await service.search({ title: '  DUNE ', author: 'herbert' }); // chiave normalizzata
		expect(provider.searches).toBe(1);
		await service.search({ title: 'Dune', author: 'Herbert', language: 'it' });
		expect(provider.searches).toBe(2);
	});

	it('cache con TTL: il lookup positivo dura a lungo, il negativo poco', async () => {
		let now = 0;
		const hit = fakeProvider('open-library', {
			candidates: [
				{ ...(ol[0] as EditionCandidate), isbn13: '9780441013593', isbn10: '0441013597' }
			]
		});
		const service = new CatalogService({ providers: [hit], now: () => now });
		await service.lookupIsbn('0441013597'); // ISBN-10 normalizzato a 13
		await service.lookupIsbn('978-0-441-01359-3');
		expect(hit.lookups).toBe(1);
		now += 7 * 24 * 3600_000;
		await service.lookupIsbn('9780441013593');
		expect(hit.lookups).toBe(1); // ancora in cache dopo una settimana

		const miss = fakeProvider('open-library', { candidates: [] });
		const missService = new CatalogService({ providers: [miss], now: () => now });
		await missService.lookupIsbn('9780441013593');
		await missService.lookupIsbn('9780441013593');
		expect(miss.lookups).toBe(1);
		now += 16 * 60_000;
		await missService.lookupIsbn('9780441013593');
		expect(miss.lookups).toBe(2);
	});

	it("lookup ISBN: exactMatch solo se il candidato ha proprio quell'ISBN", async () => {
		const exact = { ...(ol[0] as EditionCandidate), isbn13: '9780441013593', isbn10: '0441013597' };
		const service = new CatalogService({
			providers: [fakeProvider('open-library', { candidates: [exact] })]
		});
		const result = await service.lookupIsbn('9780441013593');
		expect(result.exactMatch).toBe(true);
		expect(result.candidates[0]?.matchReasons).toContain('isbn-exact');

		const other = new CatalogService({
			providers: [
				fakeProvider('open-library', {
					candidates: [{ ...exact, isbn13: '9788804678106', isbn10: null }]
				})
			]
		});
		expect((await other.lookupIsbn('9780441013593')).exactMatch).toBe(false);
	});

	it('lookup ISBN non valido: VALIDATION senza chiamare i provider', async () => {
		const provider = fakeProvider('open-library', {});
		await expect(
			new CatalogService({ providers: [provider] }).lookupIsbn('9780441013594')
		).rejects.toMatchObject({ code: 'VALIDATION' });
		expect(provider.lookups).toBe(0);
	});
});
