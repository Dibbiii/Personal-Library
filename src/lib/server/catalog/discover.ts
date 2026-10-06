import { z } from 'zod';
import { TtlCache } from '$lib/catalog/cache';
import { normalizeCoverUrl, openLibraryCoverById } from '$lib/catalog/covers';
import {
	DISCOVER_TOPICS,
	MIN_YEAR,
	type DiscoverBook,
	type DiscoverQuery,
	type DiscoverResponse,
	type DiscoverSort
} from '$lib/catalog/discover';
import { toIso2, toIso3 } from '$lib/catalog/language';
import { fetchJson, type FetchLike } from './http';
import { OPEN_LIBRARY_HOSTS, sanitizeQuery } from './open-library';

const BASE = 'https://openlibrary.org';
const MINUTE = 60 * 1000;

const FIELDS = [
	'key',
	'title',
	'author_name',
	'first_publish_year',
	'cover_i',
	'ratings_average',
	'ratings_count',
	'editions',
	'editions.key',
	'editions.title',
	'editions.cover_i',
	'editions.language'
].join(',');

const stringList = z.array(z.string()).optional();

const docSchema = z.object({
	key: z.string(),
	title: z.string(),
	author_name: stringList,
	first_publish_year: z.number().optional(),
	cover_i: z.number().optional(),
	ratings_average: z.number().optional(),
	ratings_count: z.number().optional(),
	editions: z
		.object({
			docs: z
				.array(
					z.object({
						key: z.string(),
						title: z.string().optional(),
						cover_i: z.number().optional(),
						language: stringList
					})
				)
				.optional()
		})
		.optional()
});

const responseSchema = z.object({
	numFound: z.number().default(0),
	docs: z.array(z.unknown()).default([])
});

function lastSegment(key: string): string {
	return key.split('/').filter(Boolean).pop() ?? key;
}

/** Valore Solr tra virgolette se contiene spazi. */
function term(value: string): string {
	return /\s/.test(value) ? `"${value}"` : value;
}

/** Sezioni ed elenchi -> parti della query di `search.json` (funzione pura, testata). */
export function buildDiscoverSearch(
	query: DiscoverQuery,
	currentYear = new Date().getFullYear()
): { q: string; sort: DiscoverSort } {
	const parts: string[] = [];
	let sort: DiscoverSort = query.sort;

	const text = sanitizeQuery(query.q);
	if (text) parts.push(text);

	const topics = [...query.topics];
	switch (query.section) {
		case 'classics':
			if (!topics.includes('classics')) topics.push('classics');
			if (sort === 'relevance') sort = 'rating';
			break;
		case 'new':
			parts.push(`first_publish_year:[${currentYear - 2} TO ${currentYear}]`);
			if (sort === 'relevance') sort = 'trending';
			break;
		case 'popular':
			if (sort === 'relevance') sort = 'readinglog';
			break;
		case 'trending':
			if (sort === 'relevance') sort = 'trending';
			break;
		case 'recommended':
			// Voti affidabili: si consigliano solo libri valutati da più lettori.
			parts.push('ratings_count:[20 TO *]');
			if (sort === 'relevance') sort = 'rating';
			break;
		case 'search':
			// Senza testo né temi "rilevanza" non significa nulla: si mostrano i più letti.
			if (sort === 'relevance' && !text && topics.length === 0) sort = 'readinglog';
			break;
	}

	const subjects = topics.flatMap((topic) => DISCOVER_TOPICS[topic].subjects);
	if (subjects.length > 0) parts.push(`subject:(${subjects.map(term).join(' OR ')})`);

	if (query.minRating > 0) parts.push(`ratings_average:[${query.minRating} TO *]`);

	const from = query.from !== undefined && query.from > MIN_YEAR ? query.from : null;
	const to = query.to !== undefined && query.to < currentYear ? query.to : null;
	if (from !== null || to !== null) {
		parts.push(`first_publish_year:[${from ?? '*'} TO ${to ?? '*'}]`);
	}

	const iso3 = query.lang === 'all' ? null : toIso3(query.lang);
	if (iso3) parts.push(`language:${iso3}`);

	// Open Library vuole sempre una query: in mancanza di tutto, i libri con almeno un voto.
	if (parts.length === 0) parts.push('ratings_count:[1 TO *]');
	return { q: parts.join(' '), sort };
}

/** Documento di `search.json` -> libro da mostrare (con l'edizione nella lingua chiesta). */
export function parseDiscoverDoc(raw: unknown, lang: string): DiscoverBook | null {
	const parsed = docSchema.safeParse(raw);
	if (!parsed.success) return null;
	const doc = parsed.data;
	const workTitle = doc.title.trim();
	if (!workTitle) return null;

	const iso3 = lang === 'all' ? null : toIso3(lang);
	const edition = doc.editions?.docs?.[0];
	const editionInLanguage = edition && iso3 !== null && (edition.language ?? []).includes(iso3);
	const coverId = (editionInLanguage ? edition?.cover_i : undefined) ?? doc.cover_i;

	return {
		workId: lastSegment(doc.key),
		editionId: editionInLanguage && edition ? lastSegment(edition.key) : null,
		title: (editionInLanguage && edition?.title?.trim()) || workTitle,
		workTitle,
		authors: (doc.author_name ?? []).map((name) => name.trim()).filter(Boolean),
		year: doc.first_publish_year ?? null,
		coverUrl: coverId ? normalizeCoverUrl(openLibraryCoverById(coverId, 'M')) : null,
		rating:
			doc.ratings_average && doc.ratings_count ? Math.round(doc.ratings_average * 10) / 10 : null,
		ratingCount: doc.ratings_count ?? null,
		language: editionInLanguage ? toIso2(lang) : null
	};
}

export interface DiscoverServiceOptions {
	fetch?: FetchLike | undefined;
}

/** Libri da scoprire (Open Library), con cache di processo di 30 minuti. */
export class DiscoverService {
	private readonly cache = new TtlCache<DiscoverResponse>({ maxEntries: 300 });

	constructor(private readonly options: DiscoverServiceOptions = {}) {}

	list(query: DiscoverQuery): Promise<DiscoverResponse> {
		const { q, sort } = buildDiscoverSearch(query);
		const key = JSON.stringify([q, sort, query.page, query.limit, query.cover, query.lang]);
		return this.cache.getOrLoad(
			key,
			() => this.load(q, sort, query),
			(value) => (value.books.length > 0 ? 30 * MINUTE : 5 * MINUTE)
		);
	}

	private async load(q: string, sort: DiscoverSort, query: DiscoverQuery) {
		const params = new URLSearchParams({
			q,
			fields: FIELDS,
			limit: String(query.limit),
			page: String(query.page)
		});
		if (sort !== 'relevance') params.set('sort', sort);
		const iso2 = query.lang === 'all' ? null : query.lang;
		if (iso2) params.set('lang', iso2);

		const payload = await fetchJson(`${BASE}/search.json?${params}`, {
			fetch: this.options.fetch,
			timeoutMs: 9000,
			allowedHosts: OPEN_LIBRARY_HOSTS
		});
		const response = responseSchema.safeParse(payload ?? {});
		if (!response.success) return { books: [], total: 0, hasMore: false };

		const seen = new Set<string>();
		const books: DiscoverBook[] = [];
		for (const raw of response.data.docs) {
			const book = parseDiscoverDoc(raw, query.lang);
			if (!book || seen.has(book.workId)) continue;
			// Nelle sezioni (scaffali e classifiche) un libro senza copertina stona: si salta.
			if ((query.cover || query.section !== 'search') && !book.coverUrl) continue;
			seen.add(book.workId);
			books.push(book);
		}
		const total = response.data.numFound;
		return { books, total, hasMore: query.page * query.limit < total };
	}
}
