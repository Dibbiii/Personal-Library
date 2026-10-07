import { z } from 'zod';
import type { EditionCandidate } from '$lib/contracts/books';
import { firstValidIsbn } from '$lib/catalog/isbn';
import { normalizeCoverUrl } from '$lib/catalog/covers';
import type { BookProvider, ProviderCallOptions } from '$lib/catalog/types';
import { DataAccessError } from '$lib/data/errors';
import { fetchJson, type FetchLike } from './http';

const entitySchema = z.object({
	labels: z.record(z.string(), z.string()).optional(),
	claims: z.record(z.string(), z.array(z.unknown())).optional(),
	image: z.object({ url: z.string().optional() }).optional()
});
const responseSchema = z.object({ entities: z.record(z.string(), z.unknown()) });
type Entity = z.infer<typeof entitySchema>;
const values = (entity: Entity, property: string) => entity.claims?.[property] ?? [];
const strings = (entity: Entity, property: string) =>
	values(entity, property).filter((v): v is string => typeof v === 'string');
const label = (entity: Entity | undefined) =>
	entity?.labels?.it ??
	entity?.labels?.mul ??
	entity?.labels?.en ??
	entity?.labels?.fromclaims ??
	Object.values(entity?.labels ?? {})[0] ??
	null;
// Wikidata language entities, not guessed from the edition title.
const LANGUAGES: Record<string, string> = {
	'wd:Q652': 'it',
	'wd:Q1860': 'en',
	'wd:Q150': 'fr',
	'wd:Q188': 'de',
	'wd:Q1321': 'es',
	'wd:Q5146': 'pt'
};

export function parseInventaire(payload: unknown, isbn13: string): EditionCandidate[] {
	const response = responseSchema.safeParse(payload);
	if (!response.success) throw new DataAccessError('CONTRACT', 'Risposta Inventaire non valida');
	const entities = new Map(
		Object.entries(response.data.entities).flatMap(([uri, raw]) => {
			const parsed = entitySchema.safeParse(raw);
			return parsed.success ? [[uri, parsed.data] as const] : [];
		})
	);
	const candidates: EditionCandidate[] = [];
	for (const [uri, entity] of entities) {
		if (!/^(inv:[a-f0-9]{32}|wd:Q[0-9]+)$/.test(uri)) continue;
		const identifiers = [...strings(entity, 'wdt:P212'), ...strings(entity, 'wdt:P957')];
		const isbn = identifiers.map((id) => firstValidIsbn([id])).find((id) => id?.isbn13 === isbn13);
		if (!isbn) continue;
		const title = strings(entity, 'wdt:P1476')[0]?.trim() || label(entity);
		if (!title) continue;
		const work = entities.get(strings(entity, 'wdt:P629')[0] ?? '');
		const authorUris = [...strings(entity, 'wdt:P50'), ...(work ? strings(work, 'wdt:P50') : [])];
		const authors = [
			...new Set(
				authorUris
					.map((id) => label(entities.get(id)))
					.filter((name): name is string => Boolean(name))
			)
		];
		const pages = values(entity, 'wdt:P1104')[0];
		const image = entity.image?.url;
		let coverUrl: string | null = null;
		try {
			coverUrl = image
				? normalizeCoverUrl(new URL(image, 'https://inventaire.io').toString())
				: null;
		} catch {
			/* A malformed cover must not discard bibliographic data. */
		}
		candidates.push({
			provider: 'inventaire',
			providerIds: {
				openLibraryWorkId: null,
				openLibraryEditionId:
					strings(entity, 'wdt:P648').find((id) => /^OL[0-9]+M$/.test(id)) ?? null,
				googleBooksId: null,
				inventaireId: uri
			},
			workTitle: label(work) ?? title,
			editionTitle: title,
			authors: authors.length ? authors : ['Autore sconosciuto'],
			isbn13: isbn.isbn13,
			isbn10: isbn.isbn10,
			language: LANGUAGES[strings(entity, 'wdt:P407')[0] ?? ''] ?? null,
			publisher: label(entities.get(strings(entity, 'wdt:P123')[0] ?? '')),
			publishedDate: strings(entity, 'wdt:P577')[0] ?? null,
			pageCount:
				typeof pages === 'number' && Number.isInteger(pages) && pages > 0 && pages <= 20000
					? pages
					: null,
			coverUrl,
			confidence: 0,
			matchReasons: []
		});
	}
	return candidates;
}

export class InventaireProvider implements BookProvider {
	readonly id = 'inventaire' as const;
	constructor(private readonly fetchImpl?: FetchLike) {}
	async search(): Promise<EditionCandidate[]> {
		return [];
	}
	async lookupIsbn(isbn13: string, options?: ProviderCallOptions): Promise<EditionCandidate[]> {
		const params = new URLSearchParams({
			uris: `isbn:${isbn13}`,
			relatives: 'wdt:P629|wdt:P50|wdt:P123',
			attributes: 'labels|claims|image'
		});
		const raw = await fetchJson(`https://inventaire.io/api/entities/by-uris?${params}`, {
			allowedHosts: ['inventaire.io'],
			fetch: this.fetchImpl,
			signal: options?.signal
		});
		return raw === null ? [] : parseInventaire(raw, isbn13);
	}
}
