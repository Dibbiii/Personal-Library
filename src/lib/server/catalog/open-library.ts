import { z } from 'zod';
import type { EditionCandidate } from '$lib/contracts/books';
import type { BookSearchRequest } from '$lib/contracts/rpc';
import { normalizeCoverUrl, openLibraryCoverById } from '$lib/catalog/covers';
import { firstValidIsbn, parseIsbn } from '$lib/catalog/isbn';
import { toIso2 } from '$lib/catalog/language';
import type { BookProvider, ProviderCallOptions } from '$lib/catalog/types';
import { fetchJson, type FetchLike } from './http';

export const OPEN_LIBRARY_HOSTS = ['openlibrary.org'] as const;
const BASE = 'https://openlibrary.org';

const SEARCH_FIELDS = [
	'key',
	'title',
	'author_name',
	'author_key',
	'first_publish_year',
	'cover_i',
	'language',
	'editions',
	'editions.key',
	'editions.title',
	'editions.isbn',
	'editions.language',
	'editions.publisher',
	'editions.cover_i',
	'editions.publish_date'
].join(',');

const stringList = z.array(z.string()).optional();

const editionDocSchema = z.object({
	key: z.string(),
	title: z.string().optional(),
	cover_i: z.number().optional(),
	language: stringList,
	publisher: stringList,
	publish_date: stringList,
	isbn: stringList
});

const searchDocSchema = z.object({
	key: z.string(),
	title: z.string(),
	author_name: stringList,
	cover_i: z.number().optional(),
	language: stringList,
	editions: z.object({ docs: z.array(editionDocSchema).optional() }).optional()
});

const searchResponseSchema = z.object({ docs: z.array(z.unknown()).default([]) });

const editionJsonSchema = z.object({
	key: z.string().optional(),
	title: z.string().optional(),
	number_of_pages: z.number().optional(),
	publishers: stringList,
	publish_date: z.string().optional(),
	isbn_10: stringList,
	isbn_13: stringList,
	covers: z.array(z.number()).optional(),
	languages: z.array(z.object({ key: z.string() })).optional(),
	works: z.array(z.object({ key: z.string() })).optional(),
	authors: z.array(z.object({ key: z.string() })).optional()
});

const nameSchema = z.object({ name: z.string().optional(), title: z.string().optional() });

/** Toglie i caratteri speciali di Solr dalla query utente. */
export function sanitizeQuery(value: string): string {
	return value
		.replace(/[^\p{L}\p{N}\s'.,&-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
}

/**
 * Ricerca testuale libera: Open Library distingue i campi, quindi li interroghiamo tutti.
 * Il testo è già sanificato prima di essere inserito nella query Solr.
 */
export function buildTextSearchQuery(value: string): string {
	const text = sanitizeQuery(value);
	if (!text) return '';
	return `(title:(${text}) OR author:(${text}) OR publisher:(${text}))`;
}

function lastKeySegment(key: string): string {
	return key.split('/').filter(Boolean).pop() ?? key;
}

const UNKNOWN_AUTHOR = 'Autore sconosciuto';

function buildCandidate(doc: z.infer<typeof searchDocSchema>): EditionCandidate | null {
	const edition = doc.editions?.docs?.[0];
	const isbn = firstValidIsbn(edition?.isbn);
	const coverId = edition ? edition.cover_i : doc.cover_i;
	const languages = edition?.language ?? (doc.language?.length === 1 ? doc.language : undefined);
	const authors = (doc.author_name ?? []).map((name) => name.trim()).filter(Boolean);
	const title = doc.title.trim();
	if (!title) return null;

	return {
		provider: 'open-library',
		providerIds: {
			openLibraryWorkId: lastKeySegment(doc.key),
			openLibraryEditionId: edition ? lastKeySegment(edition.key) : null,
			googleBooksId: null
		},
		workTitle: title,
		editionTitle: edition?.title?.trim() || title,
		authors: authors.length > 0 ? authors : [UNKNOWN_AUTHOR],
		isbn10: isbn?.isbn10 ?? null,
		isbn13: isbn?.isbn13 ?? null,
		language: toIso2(languages?.[0]),
		publisher: edition?.publisher?.[0]?.trim() || null,
		publishedDate: edition?.publish_date?.[0]?.trim() || null,
		pageCount: null,
		coverUrl: coverId ? normalizeCoverUrl(openLibraryCoverById(coverId, 'L')) : null,
		confidence: 0,
		matchReasons: []
	};
}

/** Risposta di search.json -> candidati (funzione pura, usata anche dai test con fixture). */
export function parseSearchResponse(payload: unknown): EditionCandidate[] {
	const response = searchResponseSchema.safeParse(payload);
	if (!response.success) return [];
	const candidates: EditionCandidate[] = [];
	for (const raw of response.data.docs) {
		const doc = searchDocSchema.safeParse(raw);
		if (!doc.success) continue;
		const candidate = buildCandidate(doc.data);
		if (candidate) candidates.push(candidate);
	}
	return candidates;
}

/** Arricchisce un candidato con il JSON dell'edizione (`/isbn/<isbn>.json`). */
export function applyEditionJson(
	candidate: EditionCandidate,
	payload: unknown,
	isbn13: string
): EditionCandidate {
	const parsed = editionJsonSchema.safeParse(payload);
	if (!parsed.success) return candidate;
	const edition = parsed.data;
	const identifiers = [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])];
	const exact = identifiers.find((value) => parseIsbn(value)?.isbn13 === isbn13);
	const isbn = firstValidIsbn(exact ? [exact] : identifiers);
	const coverId = edition.covers?.find((id) => id > 0);

	return {
		...candidate,
		providerIds: {
			...candidate.providerIds,
			openLibraryEditionId: edition.key
				? lastKeySegment(edition.key)
				: candidate.providerIds.openLibraryEditionId,
			openLibraryWorkId: edition.works?.[0]
				? lastKeySegment(edition.works[0].key)
				: candidate.providerIds.openLibraryWorkId
		},
		editionTitle: edition.title?.trim() || candidate.editionTitle,
		isbn10: isbn?.isbn10 ?? candidate.isbn10,
		isbn13: isbn?.isbn13 ?? candidate.isbn13,
		language: toIso2(edition.languages?.[0]?.key) ?? candidate.language,
		publisher: edition.publishers?.[0]?.trim() || candidate.publisher,
		publishedDate: edition.publish_date?.trim() || candidate.publishedDate,
		pageCount:
			edition.number_of_pages && edition.number_of_pages > 0
				? Math.round(edition.number_of_pages)
				: candidate.pageCount,
		coverUrl: coverId ? normalizeCoverUrl(openLibraryCoverById(coverId, 'L')) : candidate.coverUrl
	};
}

export interface OpenLibraryOptions {
	fetch?: FetchLike | undefined;
	timeoutMs?: number | undefined;
}

export class OpenLibraryProvider implements BookProvider {
	readonly id = 'open-library' as const;

	constructor(private readonly options: OpenLibraryOptions = {}) {}

	private get(path: string, signal?: AbortSignal | undefined): Promise<unknown | null> {
		return fetchJson(`${BASE}${path}`, {
			fetch: this.options.fetch,
			timeoutMs: this.options.timeoutMs,
			signal,
			allowedHosts: OPEN_LIBRARY_HOSTS
		});
	}

	private searchPath(query: string, limit: number, language?: string): string {
		const params = new URLSearchParams({ q: query, limit: String(limit), fields: SEARCH_FIELDS });
		const preferredLanguage = toIso2(language);
		if (preferredLanguage && /^[a-z]{2}$/.test(preferredLanguage)) {
			params.set('lang', preferredLanguage);
		}
		return `/search.json?${params}`;
	}

	async search(
		request: BookSearchRequest,
		options?: ProviderCallOptions
	): Promise<EditionCandidate[]> {
		const text = sanitizeQuery(request.title);
		if (!text) return [];
		// Mantiene la ricerca strutturata titolo + autore per i chiamanti che la usano;
		// il flusso con campo unico cerca invece nei tre metadati bibliografici.
		const author = request.author ? sanitizeQuery(request.author) : '';
		const terms = author ? `title:(${text}) author:(${author})` : buildTextSearchQuery(text);

		// `lang` favorisce l'edizione nella lingua preferita senza escludere le altre.
		const payload = await this.get(this.searchPath(terms, 40, request.language), options?.signal);
		return parseSearchResponse(payload);
	}

	async lookupIsbn(isbn13: string, options?: ProviderCallOptions): Promise<EditionCandidate[]> {
		const [searchResult, editionResult] = await Promise.allSettled([
			this.get(this.searchPath(`isbn:${isbn13}`, 3), options?.signal),
			this.get(`/isbn/${encodeURIComponent(isbn13)}.json`, options?.signal)
		]);

		// Se entrambe le chiamate falliscono è un errore del provider; se ne riesce una si usa quella.
		if (searchResult.status === 'rejected' && editionResult.status === 'rejected') {
			throw searchResult.reason;
		}

		const fromSearch =
			searchResult.status === 'fulfilled' ? parseSearchResponse(searchResult.value)[0] : undefined;
		const editionPayload = editionResult.status === 'fulfilled' ? editionResult.value : null;

		if (
			fromSearch &&
			(!editionPayload ||
				editionJsonSchema
					.safeParse(editionPayload)
					.data?.key?.endsWith(`/${fromSearch.providerIds.openLibraryEditionId}`))
		) {
			return [editionPayload ? applyEditionJson(fromSearch, editionPayload, isbn13) : fromSearch];
		}

		// Non indicizzato nella ricerca: ricostruisce da edizione + opera + autori.
		const edition = editionJsonSchema.safeParse(editionPayload);
		if (!edition.success) return [];
		const title = edition.data.title?.trim();
		if (!title) return [];

		const names = await Promise.all(
			(edition.data.authors ?? []).slice(0, 3).map(async (author) => {
				try {
					const payload = nameSchema.safeParse(
						await this.get(`${author.key}.json`, options?.signal)
					);
					return payload.success ? (payload.data.name?.trim() ?? null) : null;
				} catch {
					return null;
				}
			})
		);
		const workKey = edition.data.works?.[0]?.key;
		const sameWork =
			workKey && fromSearch?.providerIds.openLibraryWorkId === lastKeySegment(workKey);
		let workTitle = title;
		if (workKey) {
			try {
				const payload = nameSchema.safeParse(await this.get(`${workKey}.json`, options?.signal));
				if (payload.success && payload.data.title) workTitle = payload.data.title.trim();
			} catch {
				// il titolo dell'edizione basta
			}
		}

		const base: EditionCandidate = {
			provider: 'open-library',
			providerIds: {
				openLibraryWorkId: workKey ? lastKeySegment(workKey) : null,
				openLibraryEditionId: null,
				googleBooksId: null
			},
			workTitle,
			editionTitle: title,
			authors: names.filter((name): name is string => Boolean(name)).length
				? names.filter((name): name is string => Boolean(name))
				: sameWork
					? fromSearch.authors
					: [UNKNOWN_AUTHOR],
			isbn10: null,
			isbn13: null,
			language: null,
			publisher: null,
			publishedDate: null,
			pageCount: null,
			coverUrl: null,
			confidence: 0,
			matchReasons: []
		};
		return [applyEditionJson(base, editionPayload, isbn13)];
	}
}
