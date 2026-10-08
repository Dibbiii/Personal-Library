import { describe, expect, it, vi } from 'vitest';
import { EditionsService } from '../../src/lib/server/catalog/editions';
import { editionsQuerySchema } from '../../src/lib/catalog/editions';

describe('edizioni paginate', () => {
	it('mantiene metadati dell’edizione, pagina sui record grezzi e cachea ogni pagina', async () => {
		const fetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						size: 3,
						entries: [
							{
								key: '/books/OL1M',
								title: 'Dune',
								publish_date: '2025',
								isbn_13: ['9780441013593'],
								languages: [{ key: '/languages/eng' }]
							},
							{ key: '/unexpected' }
						]
					})
				)
		);
		const service = new EditionsService(fetch);
		const first = await service.get('OL1W');
		expect(first).toMatchObject({
			total: 3,
			nextOffset: 2,
			editions: [{ year: 2025, pages: null, language: 'en', isbn13: '9780441013593' }]
		});
		await service.get('OL1W');
		expect(fetch).toHaveBeenCalledTimes(1);
		await service.get('OL1W', 2);
		expect(fetch.mock.calls.length).toBe(2);
	});
	it('non crea loop su pagine vuote, segnala payload malformati e rifiuta percorsi arbitrari', async () => {
		const empty = new EditionsService(async () => new Response('{"size":10,"entries":[]}'));
		expect((await empty.get('OL1W')).nextOffset).toBeNull();
		const invalid = new EditionsService(async () => new Response('{}'));
		await expect(invalid.get('OL1W')).rejects.toMatchObject({ code: 'CONTRACT' });
		expect(editionsQuerySchema.safeParse({ workId: '../admin' }).success).toBe(false);
		expect(editionsQuerySchema.safeParse({ workId: 'OL1W', offset: -1 }).success).toBe(false);
	});
});
