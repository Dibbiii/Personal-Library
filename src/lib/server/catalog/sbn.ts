import { z } from 'zod';
import type { EditionCandidate } from '$lib/contracts/books';
import type { BookSearchRequest } from '$lib/contracts/rpc';
import { firstValidIsbn } from '$lib/catalog/isbn';
import { toIso2 } from '$lib/catalog/language';
import type { BookProvider, ProviderCallOptions } from '$lib/catalog/types';
import { DataAccessError } from '$lib/data/errors';
import type { FetchLike } from './http';

const recordSchema = z.object({
	id: z.string().regex(/^[A-Z0-9]{10}$/),
	title: z.string().min(1),
	authors: z.array(z.string()),
	isbns: z.array(z.string()),
	language: z.string().nullable(),
	publisher: z.string().nullable(),
	publishedDate: z.string().nullable(),
	pageCount: z.number().int().positive().max(20000).nullable()
});
const responseSchema = z.object({ records: z.array(z.unknown()) });

export function parseSbn(payload: unknown, isbn13?: string): EditionCandidate[] {
	const response = responseSchema.safeParse(payload);
	if (!response.success) throw new DataAccessError('CONTRACT', 'Risposta SBN non valida');
	return response.data.records.flatMap((raw) => {
		const parsed = recordSchema.safeParse(raw);
		if (!parsed.success) return [];
		const r = parsed.data;
		const identifiers = r.isbns.map((id) => firstValidIsbn([id.replace(/\s*\(.*/, '').trim()]));
		const isbn = identifiers.find((id) => id?.isbn13 === isbn13) ?? identifiers.find(Boolean);
		return [
			{
				provider: 'sbn' as const,
				providerIds: {
					openLibraryWorkId: null,
					openLibraryEditionId: null,
					googleBooksId: null,
					sbnId: r.id
				},
				workTitle: r.title,
				editionTitle: r.title,
				authors: r.authors.length ? r.authors : ['Autore sconosciuto'],
				isbn10: isbn?.isbn10 ?? null,
				isbn13: isbn?.isbn13 ?? null,
				language: toIso2(r.language),
				publisher: r.publisher,
				publishedDate: r.publishedDate,
				pageCount: r.pageCount,
				coverUrl: null,
				confidence: 0,
				matchReasons: []
			}
		];
	});
}

/** Fixed internal bridge address from server configuration, never from the request. */
export class SbnProvider implements BookProvider {
	readonly id = 'sbn' as const;
	private readonly base: URL;
	constructor(
		base: string,
		private readonly fetchImpl: FetchLike = fetch
	) {
		this.base = new URL(base);
		if (
			!['http:', 'https:'].includes(this.base.protocol) ||
			this.base.username ||
			this.base.password ||
			this.base.search ||
			this.base.hash ||
			this.base.pathname !== '/'
		)
			throw new Error('SBN_BRIDGE_URL must be an HTTP origin');
	}
	private async get(params: URLSearchParams, signal?: AbortSignal) {
		let response: Response;
		try {
			response = await this.fetchImpl(new URL(`/search?${params}`, this.base).toString(), {
				signal: signal
					? AbortSignal.any([signal, AbortSignal.timeout(20000)])
					: AbortSignal.timeout(20000),
				redirect: 'error'
			});
		} catch (error) {
			throw new DataAccessError('NETWORK', 'Catalogo SBN non raggiungibile', error);
		}
		if (response.status === 429) throw new DataAccessError('RATE_LIMITED', 'Catalogo SBN occupato');
		if (!response.ok) throw new DataAccessError('NETWORK', 'Catalogo SBN non disponibile');
		try {
			const text = await response.text();
			if (text.length > 2_000_000) throw new Error('oversized');
			return JSON.parse(text) as unknown;
		} catch (error) {
			throw new DataAccessError('CONTRACT', 'Risposta SBN non valida', error);
		}
	}
	async search(request: BookSearchRequest, options?: ProviderCallOptions) {
		return parseSbn(
			await this.get(
				new URLSearchParams({
					title: request.title,
					...(request.author ? { author: request.author } : {})
				}),
				options?.signal
			)
		);
	}
	async lookupIsbn(isbn13: string, options?: ProviderCallOptions) {
		return parseSbn(await this.get(new URLSearchParams({ isbn: isbn13 }), options?.signal), isbn13);
	}
}
