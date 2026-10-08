import { z } from 'zod';
import type { EditionCandidate } from '$lib/contracts/books';
import type { BookSearchRequest } from '$lib/contracts/rpc';
import { normalizeCoverUrl } from '$lib/catalog/covers';
import { firstValidIsbn } from '$lib/catalog/isbn';
import { toIso2 } from '$lib/catalog/language';
import type { BookProvider, ProviderCallOptions } from '$lib/catalog/types';
import { fetchJson, type FetchLike } from './http';

export const GOOGLE_BOOKS_HOSTS = ['www.googleapis.com'] as const;
const BASE = 'https://www.googleapis.com/books/v1/volumes';
const FIELDS =
	'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,pageCount,language,industryIdentifiers,imageLinks))';

const volumeSchema = z.object({
	id: z.string(),
	volumeInfo: z.object({
		title: z.string().optional(),
		authors: z.array(z.string()).optional(),
		publisher: z.string().optional(),
		publishedDate: z.string().optional(),
		pageCount: z.number().optional(),
		language: z.string().optional(),
		industryIdentifiers: z
			.array(z.object({ type: z.string().optional(), identifier: z.string().optional() }))
			.optional(),
		imageLinks: z
			.object({ thumbnail: z.string().optional(), smallThumbnail: z.string().optional() })
			.optional()
	})
});

const responseSchema = z.object({ items: z.array(z.unknown()).default([]) });

/** Toglie i virgolette e gli operatori di ricerca dalla query utente. */
function clean(value: string): string {
	return value
		.replace(/[^\p{L}\p{N}\s'.,&-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
}

export function parseVolumes(payload: unknown): EditionCandidate[] {
	const response = responseSchema.safeParse(payload);
	if (!response.success) return [];

	const candidates: EditionCandidate[] = [];
	for (const raw of response.data.items) {
		const volume = volumeSchema.safeParse(raw);
		if (!volume.success) continue;
		const { id, volumeInfo: info } = volume.data;
		const title = info.title?.trim();
		if (!title) continue;

		const isbn = firstValidIsbn(
			(info.industryIdentifiers ?? [])
				.filter((identifier) => identifier.type?.startsWith('ISBN'))
				.map((identifier) => identifier.identifier ?? '')
		);
		const authors = (info.authors ?? []).map((name) => name.trim()).filter(Boolean);

		candidates.push({
			provider: 'google-books',
			providerIds: { openLibraryWorkId: null, openLibraryEditionId: null, googleBooksId: id },
			workTitle: title,
			editionTitle: title,
			authors: authors.length > 0 ? authors : ['Autore sconosciuto'],
			isbn10: isbn?.isbn10 ?? null,
			isbn13: isbn?.isbn13 ?? null,
			language: toIso2(info.language),
			publisher: info.publisher?.trim() || null,
			publishedDate: info.publishedDate?.trim() || null,
			pageCount: info.pageCount && info.pageCount > 0 ? Math.round(info.pageCount) : null,
			coverUrl: normalizeCoverUrl(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
			confidence: 0,
			matchReasons: []
		});
	}
	return candidates;
}

export interface GoogleBooksOptions {
	/** Chiave API (solo server). Opzionale: senza chiave la quota anonima è molto bassa. */
	apiKey?: string | undefined;
	fetch?: FetchLike | undefined;
	timeoutMs?: number | undefined;
}

export class GoogleBooksProvider implements BookProvider {
	readonly id = 'google-books' as const;

	constructor(private readonly options: GoogleBooksOptions = {}) {}

	private get(
		query: string,
		maxResults: number,
		signal?: AbortSignal | undefined,
		sort?: BookSearchRequest['sort']
	) {
		const params = new URLSearchParams({
			q: query,
			maxResults: String(maxResults),
			printType: 'books',
			fields: FIELDS
		});
		if (this.options.apiKey) params.set('key', this.options.apiKey);
		if (sort) params.set('orderBy', sort);
		return fetchJson(`${BASE}?${params}`, {
			fetch: this.options.fetch,
			timeoutMs: this.options.timeoutMs,
			signal,
			allowedHosts: GOOGLE_BOOKS_HOSTS
		});
	}

	async search(
		request: BookSearchRequest,
		options?: ProviderCallOptions
	): Promise<EditionCandidate[]> {
		const title = clean(request.title);
		if (!title) return [];
		const author = request.author ? clean(request.author) : '';
		const query = author ? `intitle:"${title}" inauthor:"${author}"` : title;
		return parseVolumes(await this.get(query, 40, options?.signal, request.sort ?? 'relevance'));
	}

	async lookupIsbn(isbn13: string, options?: ProviderCallOptions): Promise<EditionCandidate[]> {
		return parseVolumes(await this.get(`isbn:${isbn13}`, 5, options?.signal));
	}
}
