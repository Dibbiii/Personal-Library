import { describe, expect, it } from 'vitest';
import { InventaireProvider, parseInventaire } from '../../src/lib/server/catalog/inventaire';
import { editionCandidateSchema } from '../../src/lib/contracts/books';

const payload = {
	entities: {
		'inv:0123456789abcdef0123456789abcdef': {
			labels: { fromclaims: 'Il piccolo principe' },
			claims: {
				'wdt:P212': ['978-2-07-011627-0'],
				'wdt:P1476': ['Il piccolo principe'],
				'wdt:P629': ['wd:work'],
				'wdt:P123': ['wd:publisher'],
				'wdt:P407': ['wd:Q652'],
				'wdt:P577': ['1999-11-24'],
				'wdt:P1104': [95]
			},
			image: { url: '/img/entities/test' }
		},
		'wd:work': { labels: { it: 'Il piccolo principe' }, claims: { 'wdt:P50': ['wd:author'] } },
		'wd:author': { labels: { mul: 'Antoine de Saint-Exupéry' } },
		'wd:publisher': { labels: { it: 'Gallimard' } }
	}
};

describe('Inventaire ISBN', () => {
	it('risolve metadati collegati e cover relative solo per ISBN dichiarato', () => {
		const [candidate] = parseInventaire(payload, '9782070116270');
		expect(editionCandidateSchema.safeParse(candidate).success).toBe(true);
		expect(candidate).toMatchObject({
			provider: 'inventaire',
			authors: ['Antoine de Saint-Exupéry'],
			publisher: 'Gallimard',
			language: 'it',
			pageCount: 95,
			coverUrl: 'https://inventaire.io/img/entities/test',
			providerIds: { inventaireId: 'inv:0123456789abcdef0123456789abcdef' }
		});
		expect(parseInventaire(payload, '9780441013593')).toEqual([]);
	});
	it('assenza normale distinta da payload malformato e da errore di rete', async () => {
		const withBrokenImage = structuredClone(payload);
		withBrokenImage.entities['inv:0123456789abcdef0123456789abcdef'].image.url = 'http://[';
		expect(parseInventaire(withBrokenImage, '9782070116270')[0]?.coverUrl).toBeNull();
		expect(parseInventaire({ entities: {} }, '9782070116270')).toEqual([]);
		expect(() => parseInventaire({}, '9782070116270')).toThrow();
		const provider = new InventaireProvider(async (url) => {
			expect(url).toContain('/api/entities/by-uris?');
			return new Response('busy', { status: 429 });
		});
		await expect(provider.lookupIsbn('9782070116270')).rejects.toMatchObject({
			code: 'RATE_LIMITED'
		});
	});
});
