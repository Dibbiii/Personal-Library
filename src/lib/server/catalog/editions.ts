import { z } from 'zod';
import { TtlCache } from '$lib/catalog/cache';
import { editionsQuerySchema, type EditionsPage } from '$lib/catalog/editions';
import { firstValidIsbn } from '$lib/catalog/isbn';
import { toIso2 } from '$lib/catalog/language';
import { parsePublishedDate } from '$lib/catalog/published-date';
import { openLibraryCoverById } from '$lib/catalog/covers';
import { DataAccessError } from '$lib/data/errors';
import { fetchJson, type FetchLike } from './http';

const strings = z.array(z.string()).optional();
const response = z.object({ size: z.number().int().nonnegative(), entries: z.array(z.unknown()) });
const edition = z.object({
	key: z.string().regex(/^\/books\/OL[0-9]+M$/),
	title: z.string().optional(),
	publishers: strings,
	publish_date: z.string().optional(),
	isbn_13: strings,
	isbn_10: strings,
	number_of_pages: z.number().int().positive().optional(),
	covers: z.array(z.number()).optional(),
	languages: z.array(z.object({ key: z.string() })).optional()
});
const PAGE_SIZE = 40;

export class EditionsService {
	private cache = new TtlCache<EditionsPage>({ maxEntries: 500 });
	constructor(private readonly fetchImpl?: FetchLike) {}
	get(workId: string, offset = 0): Promise<EditionsPage> {
		const query = editionsQuerySchema.parse({ workId, offset });
		return this.cache.getOrLoad(
			`${query.workId}:${query.offset}`,
			async () => {
				const raw = await fetchJson(
					`https://openlibrary.org/works/${query.workId}/editions.json?limit=${PAGE_SIZE}&offset=${query.offset}`,
					{
						allowedHosts: ['openlibrary.org'],
						fetch: this.fetchImpl
					}
				);
				if (raw === null) return { editions: [], total: 0, nextOffset: null };
				const parsed = response.safeParse(raw);
				if (!parsed.success) throw new DataAccessError('CONTRACT', 'Risposta edizioni non valida');
				const next = query.offset + parsed.data.entries.length;
				return {
					total: parsed.data.size,
					nextOffset:
						parsed.data.entries.length > 0 && next < parsed.data.size && next <= 10000
							? next
							: null,
					editions: parsed.data.entries.flatMap((rawEdition) => {
						const item = edition.safeParse(rawEdition);
						if (!item.success) return [];
						const e = item.data;
						const isbn = firstValidIsbn([...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])]);
						const cover = e.covers?.find((id) => id > 0);
						return [
							{
								title: e.title?.trim() || 'Senza titolo',
								publisher: e.publishers?.[0]?.trim() || null,
								year: parsePublishedDate(e.publish_date).year,
								language: toIso2(e.languages?.[0]?.key),
								pages: e.number_of_pages ?? null,
								isbn13: isbn?.isbn13 ?? null,
								coverUrl: cover ? openLibraryCoverById(cover, 'M') : null,
								url: `https://openlibrary.org${e.key}`
							}
						];
					})
				};
			},
			(value) => (value.editions.length ? 12 * 60 * 60 * 1000 : 15 * 60 * 1000)
		);
	}
}
export const editionsService = new EditionsService();
