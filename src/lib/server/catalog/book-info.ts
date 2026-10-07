import { z } from 'zod';
import { TtlCache } from '$lib/catalog/cache';
import type { BookInfo } from '$lib/catalog/book-info';
import { normalizeCoverUrl, openLibraryCoverById } from '$lib/catalog/covers';
import { firstValidIsbn } from '$lib/catalog/isbn';
import { toIso2 } from '$lib/catalog/language';
import { authorSimilarity, textKey, titleSimilarity } from '$lib/catalog/text';
import { fetchJson, type FetchLike } from './http';
import { GOOGLE_BOOKS_HOSTS } from './google-books';
import { OPEN_LIBRARY_HOSTS, sanitizeQuery } from './open-library';

const OL = 'https://openlibrary.org';
const HOUR = 60 * 60 * 1000;

export interface BookInfoQuery {
	title: string;
	author: string;
	/** Lingua del libro nella libreria: le edizioni in questa lingua vengono prima. */
	language?: string | null;
}

// ---------- schemi delle risposte (solo i campi usati) ----------------------------

const strings = z.array(z.string()).optional();
const textValue = z.union([z.string(), z.object({ value: z.string() })]).optional();

const searchDocSchema = z.object({
	key: z.string(),
	title: z.string(),
	author_name: strings,
	author_key: strings,
	first_publish_year: z.number().optional(),
	edition_count: z.number().optional(),
	number_of_pages_median: z.number().optional(),
	ratings_average: z.number().optional(),
	ratings_count: z.number().optional(),
	already_read_count: z.number().optional(),
	want_to_read_count: z.number().optional(),
	currently_reading_count: z.number().optional(),
	cover_i: z.number().optional()
});
type SearchDoc = z.infer<typeof searchDocSchema>;

const searchSchema = z.object({ docs: z.array(z.unknown()).default([]) });

const workSchema = z.object({
	title: z.string().optional(),
	description: textValue,
	subjects: strings,
	subject_people: strings,
	subject_places: strings,
	subject_times: strings,
	excerpts: z
		.array(z.object({ excerpt: z.string().optional(), comment: z.string().optional() }))
		.optional(),
	links: z.array(z.object({ title: z.string().optional(), url: z.string().optional() })).optional()
});

const editionsSchema = z.object({
	entries: z
		.array(
			z.object({
				key: z.string(),
				title: z.string().optional(),
				publishers: strings,
				publish_date: z.string().optional(),
				number_of_pages: z.number().optional(),
				isbn_13: strings,
				isbn_10: strings,
				covers: z.array(z.number()).optional(),
				languages: z.array(z.object({ key: z.string() })).optional()
			})
		)
		.default([])
});

const authorSchema = z.object({
	name: z.string().optional(),
	bio: textValue,
	birth_date: z.string().optional(),
	death_date: z.string().optional(),
	photos: z.array(z.number()).optional()
});

const googleSchema = z.object({
	items: z
		.array(
			z.object({
				volumeInfo: z.object({
					title: z.string().optional(),
					authors: strings,
					description: z.string().optional(),
					language: z.string().optional()
				})
			})
		)
		.default([])
});

// ---------- funzioni pure (testate) -------------------------------------------------

function text(value: z.infer<typeof textValue>): string | null {
	if (!value) return null;
	return typeof value === 'string' ? value : value.value;
}

/**
 * Descrizioni di Open Library/Google: via HTML, riferimenti markdown "([fonte][1])", sezioni
 * "----------" con i link in fondo e spazi in eccesso.
 */
export function cleanDescription(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const cleaned = raw
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.split(/\n-{3,}|\n\*{3,}|\nContains:\n/)[0]!
		.replace(/\(\[[^\]]*\]\[\d+\]\)/g, '')
		.replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
		.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return cleaned.length >= 20 ? cleaned : null;
}

const NOISY_SUBJECT =
	/^(nyt:|new york times|fiction$|general$|literary$|large type|accessible book|protected daisy|in library|open_syllabus|award:|internet archive|lending library|reading level|translations into)/i;

/** Temi leggibili: niente etichette tecniche, duplicati o soggetti "A--b"; i piu' brevi prima. */
export function pickSubjects(subjects: readonly string[] | undefined, limit = 10): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of subjects ?? []) {
		const subject = raw.replace(/\s+/g, ' ').trim();
		if (!subject || subject.length > 32 || subject.includes('--') || subject.includes('='))
			continue;
		if (NOISY_SUBJECT.test(subject) || /\d{4}/.test(subject) || /, fiction$/i.test(subject))
			continue;
		const key = subject.toLowerCase().replace(/[^\p{L}]/gu, '');
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(subject.charAt(0).toUpperCase() + subject.slice(1));
		if (result.length >= limit) break;
	}
	return result;
}

/**
 * Sceglie l'opera giusta tra i risultati della ricerca libera: l'autore deve corrispondere
 * (meglio nessun dato che i dati di un altro libro); a parita', il titolo piu' simile e l'opera
 * con piu' edizioni (quella "canonica", non un doppione del catalogo).
 */
export function pickWork(docs: readonly SearchDoc[], query: BookInfoQuery): SearchDoc | null {
	let best: { doc: SearchDoc; score: number } | null = null;
	for (const doc of docs) {
		const author = authorSimilarity(query.author, doc.author_name ?? []);
		if (author < 0.6) continue;
		const title = titleSimilarity(query.title, doc.title);
		const editions = Math.min(1, Math.log10((doc.edition_count ?? 1) + 1) / 2);
		const score = author * 2 + title + editions;
		if (!best || score > best.score) best = { doc, score };
	}
	return best?.doc ?? null;
}

/** "May 2, 2019", "2019-05-02", "2019" -> 2019. */
export function parseYear(value: string | null | undefined): number | null {
	const match = value?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
	return match ? Number(match[1]) : null;
}

function safeLinks(links: z.infer<typeof workSchema>['links']): BookInfo['links'] {
	const result: BookInfo['links'] = [];
	for (const link of links ?? []) {
		if (!link.url || !link.title) continue;
		try {
			const url = new URL(link.url.replace(/^http:\/\//i, 'https://'));
			if (url.protocol === 'https:') result.push({ title: link.title.trim(), url: url.toString() });
		} catch {
			// link non valido: ignorato
		}
		if (result.length >= 5) break;
	}
	return result;
}

const nonEmpty = (list: readonly string[] | undefined, limit: number) =>
	[...new Set((list ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, limit);

// ---------- servizio ------------------------------------------------------------------

export interface BookInfoServiceOptions {
	fetch?: FetchLike | undefined;
	googleApiKey?: string | undefined;
}

export class BookInfoService {
	private readonly cache = new TtlCache<BookInfo | null>({ maxEntries: 500 });

	constructor(private readonly options: BookInfoServiceOptions = {}) {}

	get(query: BookInfoQuery): Promise<BookInfo | null> {
		const key = `${textKey(query.title)}|${textKey(query.author)}|${query.language ?? ''}`;
		// Miss brevi (il catalogo si aggiorna), hit per un giorno.
		return this.cache.getOrLoad(
			key,
			() => this.load(query),
			(value) => (value ? 24 * HOUR : HOUR)
		);
	}

	private ol(path: string) {
		return fetchJson(`${OL}${path}`, {
			fetch: this.options.fetch,
			allowedHosts: OPEN_LIBRARY_HOSTS
		});
	}

	private async load(query: BookInfoQuery): Promise<BookInfo | null> {
		const title = sanitizeQuery(query.title);
		const author = sanitizeQuery(query.author);
		if (!title) return null;

		const fields = [
			'key',
			'title',
			'author_name',
			'author_key',
			'first_publish_year',
			'edition_count',
			'number_of_pages_median',
			'ratings_average',
			'ratings_count',
			'already_read_count',
			'want_to_read_count',
			'currently_reading_count',
			'cover_i'
		].join(',');
		const params = new URLSearchParams({ q: `${title} ${author}`.trim(), limit: '8', fields });
		const search = searchSchema.safeParse(await this.ol(`/search.json?${params}`));
		if (!search.success) return null;
		const docs = search.data.docs.flatMap((raw) => {
			const doc = searchDocSchema.safeParse(raw);
			return doc.success ? [doc.data] : [];
		});
		const doc = pickWork(docs, query);
		if (!doc) return null;

		const workKey = doc.key.startsWith('/works/') ? doc.key : `/works/${doc.key}`;
		const authorKey = doc.author_key?.[0] ?? null;
		const settle = <T>(promise: Promise<T>) => promise.catch(() => null);

		const [workRaw, editionsRaw, authorRaw, worksRaw, google] = await Promise.all([
			settle(this.ol(`${workKey}.json`)),
			settle(this.ol(`${workKey}/editions.json?limit=40`)),
			authorKey ? settle(this.ol(`/authors/${authorKey}.json`)) : null,
			authorKey
				? settle(
						this.ol(
							`/search.json?${new URLSearchParams({
								author_key: authorKey,
								sort: 'editions',
								limit: '14',
								fields: 'key,title,first_publish_year,cover_i,ratings_average'
							})}`
						)
					)
				: null,
			this.options.googleApiKey ? settle(this.google(query)) : null
		]);

		const work = workSchema.safeParse(workRaw ?? {});
		const workData = work.success ? work.data : {};
		const olDescription = cleanDescription(text(workData.description));

		return {
			workTitle: workData.title ?? doc.title,
			workUrl: `${OL}${workKey}`,
			description: google
				? { text: google, language: query.language ?? 'it', source: 'google-books' }
				: olDescription
					? { text: olDescription, language: 'en', source: 'open-library' }
					: null,
			firstSentence:
				workData.excerpts?.find((item) => item.comment === 'first sentence')?.excerpt?.trim() ??
				null,
			firstPublishYear: doc.first_publish_year ?? null,
			subjects: pickSubjects(workData.subjects),
			people: nonEmpty(workData.subject_people, 8),
			places: nonEmpty(workData.subject_places, 6),
			times: nonEmpty(workData.subject_times, 3),
			rating:
				doc.ratings_average && doc.ratings_count
					? { average: Math.round(doc.ratings_average * 10) / 10, count: doc.ratings_count }
					: null,
			readers:
				doc.already_read_count || doc.want_to_read_count || doc.currently_reading_count
					? {
							alreadyRead: doc.already_read_count ?? 0,
							wantToRead: doc.want_to_read_count ?? 0,
							currentlyReading: doc.currently_reading_count ?? 0
						}
					: null,
			editionCount: doc.edition_count ?? null,
			pagesMedian: doc.number_of_pages_median ?? null,
			editions: this.editions(editionsRaw, query.language),
			author: this.author(authorRaw, authorKey, doc.author_name?.[0]),
			authorWorks: this.works(worksRaw, workKey, workData.title ?? doc.title),
			links: safeLinks(workData.links)
		};
	}

	/** Descrizione italiana da Google Books (solo con chiave API: senza, la quota anonima e' nulla). */
	private async google(query: BookInfoQuery): Promise<string | null> {
		const params = new URLSearchParams({
			q: `intitle:"${sanitizeQuery(query.title)}" inauthor:"${sanitizeQuery(query.author)}"`,
			maxResults: '5',
			printType: 'books',
			langRestrict: query.language ?? 'it',
			fields: 'items(volumeInfo(title,authors,description,language))',
			key: this.options.googleApiKey ?? ''
		});
		const parsed = googleSchema.safeParse(
			await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`, {
				fetch: this.options.fetch,
				allowedHosts: GOOGLE_BOOKS_HOSTS
			})
		);
		if (!parsed.success) return null;
		for (const { volumeInfo } of parsed.data.items) {
			if (authorSimilarity(query.author, volumeInfo.authors ?? []) < 0.6) continue;
			const description = cleanDescription(volumeInfo.description);
			if (description) return description;
		}
		return null;
	}

	private editions(raw: unknown, language: string | null | undefined): BookInfo['editions'] {
		const parsed = editionsSchema.safeParse(raw ?? {});
		if (!parsed.success) return [];
		const preferred = toIso2(language) ?? 'it';
		return parsed.data.entries
			.map((entry) => {
				const isbn = firstValidIsbn([...(entry.isbn_13 ?? []), ...(entry.isbn_10 ?? [])]);
				const cover = entry.covers?.find((id) => id > 0);
				return {
					title: entry.title?.trim() || 'Senza titolo',
					publisher: entry.publishers?.[0]?.trim() || null,
					year: parseYear(entry.publish_date),
					language: toIso2(entry.languages?.[0]?.key),
					pages: entry.number_of_pages && entry.number_of_pages > 0 ? entry.number_of_pages : null,
					isbn13: isbn?.isbn13 ?? null,
					coverUrl: cover ? normalizeCoverUrl(openLibraryCoverById(cover, 'M')) : null,
					url: `${OL}${entry.key}`
				};
			})
			.sort(
				(a, b) =>
					Number(b.language === preferred) - Number(a.language === preferred) ||
					Number(b.coverUrl !== null) - Number(a.coverUrl !== null) ||
					(b.year ?? 0) - (a.year ?? 0)
			)
			.slice(0, 12);
	}

	private author(
		raw: unknown,
		key: string | null,
		fallbackName: string | undefined
	): BookInfo['author'] {
		if (!key) return null;
		const parsed = authorSchema.safeParse(raw ?? {});
		const data = parsed.success ? parsed.data : {};
		const name = data.name ?? fallbackName;
		if (!name) return null;
		const photo = data.photos?.find((id) => id > 0);
		return {
			name,
			bio: cleanDescription(text(data.bio)),
			birthDate: data.birth_date ?? null,
			deathDate: data.death_date ?? null,
			photoUrl: photo ? `https://covers.openlibrary.org/a/id/${photo}-M.jpg` : null,
			url: `${OL}/authors/${key}`
		};
	}

	private works(raw: unknown, currentKey: string, currentTitle: string): BookInfo['authorWorks'] {
		const parsed = searchSchema.safeParse(raw ?? {});
		if (!parsed.success) return [];
		const seen = new Set<string>();
		const result: BookInfo['authorWorks'] = [];
		for (const item of parsed.data.docs) {
			const doc = searchDocSchema.safeParse(item);
			if (!doc.success || doc.data.key === currentKey) continue;
			// Doppioni del catalogo ("Song of Achilles" vs "The Song of Achilles") e l'opera stessa.
			const key = textKey(doc.data.title.replace(/^(the|a|an|il|lo|la|i|gli|le|l')\s+/i, ''));
			if (seen.has(key) || titleSimilarity(currentTitle, doc.data.title) >= 0.8) continue;
			seen.add(key);
			result.push({
				title: doc.data.title,
				year: doc.data.first_publish_year ?? null,
				coverUrl: doc.data.cover_i ? openLibraryCoverById(doc.data.cover_i, 'M') : null,
				rating: doc.data.ratings_average ? Math.round(doc.data.ratings_average * 10) / 10 : null,
				url: `${OL}${doc.data.key}`
			});
			if (result.length >= 10) break;
		}
		return result;
	}
}
