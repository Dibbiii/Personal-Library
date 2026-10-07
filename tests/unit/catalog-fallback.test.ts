import { describe, expect, it, vi } from 'vitest';
import type { EditionCandidate } from '../../src/lib/contracts/books';
import type { BookProvider, CatalogProviderId } from '../../src/lib/catalog/types';
import { CatalogService } from '../../src/lib/server/catalog/service';
import { DataAccessError } from '../../src/lib/data/errors';
import { parseSbn, SbnProvider } from '../../src/lib/server/catalog/sbn';

const isbn13 = '9780441013593';
const record = {
	id: 'PAR1242486',
	title: 'Dune',
	authors: ['Herbert'],
	isbns: [isbn13],
	publisher: 'Ace',
	language: 'eng',
	publishedDate: '2025',
	pageCount: 300
};
const candidate = parseSbn({ records: [record] })[0]!;
function provider(id: CatalogProviderId, data: EditionCandidate[] | Error): BookProvider {
	return {
		id,
		search: vi.fn(async () => []),
		lookupIsbn: vi.fn(async () => {
			if (data instanceof Error) throw data;
			return data;
		})
	};
}

describe('fallback ISBN', () => {
	it('l’autore esplicito esclude titoli omonimi di altri autori', async () => {
		const source = provider('sbn', []);
		source.search = vi.fn(async () => [
			{ ...candidate, authors: ['Frank Herbert'] },
			{
				...candidate,
				authors: ['Ada Verdi'],
				providerIds: { ...candidate.providerIds, sbnId: 'TST1234567' },
				isbn13: null,
				isbn10: null
			}
		]);
		const service = new CatalogService({ providers: [source] });
		const result = await service.search({ title: 'Dune', author: 'Herbert' });
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]?.authors).toEqual(['Frank Herbert']);
		expect((await service.search({ title: 'Dune', author: 'zzzzzz' })).candidates).toEqual([]);
	});
	it('prosegue dopo errori o alternative errate; conserva solo l’edizione esatta e cachea', async () => {
		const primary = provider('google-books', new DataAccessError('RATE_LIMITED', 'busy'));
		const inv = provider('inventaire', [{ ...candidate, isbn13: '9788804678106' }]);
		const sbn = provider('sbn', [candidate]);
		const service = new CatalogService({ providers: [primary], fallbackProviders: [inv, sbn] });
		const result = await service.lookupIsbn(isbn13);
		expect(result).toMatchObject({
			exactMatch: true,
			degraded: true,
			providers: { 'google-books': 'rate_limited', inventaire: 'ok', sbn: 'ok' }
		});
		expect(result.candidates).toHaveLength(1);
		await service.lookupIsbn(isbn13);
		expect(sbn.lookupIsbn).toHaveBeenCalledTimes(1);
	});
	it('una scheda esatta completa evita chiamate aggiuntive; dati di altre edizioni non la completano', async () => {
		const fallback = provider('sbn', []);
		const exact = { ...candidate, coverUrl: 'https://books.google.com/book.jpg' };
		const service = new CatalogService({
			providers: [provider('google-books', [exact])],
			fallbackProviders: [fallback]
		});
		await service.lookupIsbn(isbn13);
		expect(fallback.lookupIsbn).not.toHaveBeenCalled();
	});
	it('search ordinaria non chiama i fallback; SBN richiede una scelta esplicita', async () => {
		const sbn = provider('sbn', []);
		const service = new CatalogService({
			providers: [provider('google-books', [])],
			fallbackProviders: [sbn]
		});
		await service.search({ title: 'Dune' });
		expect(sbn.search).not.toHaveBeenCalled();
		await service.search({ title: 'Dune', source: 'sbn' });
		expect(sbn.search).toHaveBeenCalledTimes(1);
	});
	it('SBN non inventa un ISBN; distingue errori HTTP, dati invalidi e catalogo vuoto', async () => {
		expect(parseSbn({ records: [{ ...record, isbns: [] }] }, isbn13)[0]?.isbn13).toBeNull();
		expect(() => parseSbn({})).toThrow();
		await expect(
			new SbnProvider(
				'http://sbn:8080',
				async () => new Response('busy', { status: 429 })
			).lookupIsbn(isbn13)
		).rejects.toMatchObject({ code: 'RATE_LIMITED' });
		await expect(
			new SbnProvider('http://sbn:8080', async () => new Response('{"records":[]}')).lookupIsbn(
				isbn13
			)
		).resolves.toEqual([]);
	});
});
