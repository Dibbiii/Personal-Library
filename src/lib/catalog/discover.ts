import { z } from 'zod';
import type { EditionCandidate } from '$lib/contracts/books';
import type { GenreSlug } from '$lib/contracts/enums';
import { textKey } from './text';

/**
 * Esplora: libri da scoprire nel catalogo pubblico di Open Library (sola lettura).
 * Le sezioni e i filtri diventano query di `search.json`, costruite solo sul server.
 */

export const discoverBookSchema = z.object({
	/** Id dell'opera su Open Library (OL…W). */
	workId: z.string(),
	/** Edizione mostrata (nella lingua scelta, se c'è). */
	editionId: z.string().nullable(),
	title: z.string(),
	workTitle: z.string(),
	authors: z.array(z.string()),
	year: z.number().int().nullable(),
	coverUrl: z.string().url().nullable(),
	rating: z.number().nullable(),
	ratingCount: z.number().int().nullable(),
	language: z.string().nullable()
});

export type DiscoverBook = z.infer<typeof discoverBookSchema>;

/** Temi (chip, filtri e tessere "Esplora per tema") -> soggetti di Open Library. */
export const DISCOVER_TOPICS = {
	fantasy: { label: 'Fantasy', subjects: ['fantasy'] },
	scifi: { label: 'Fantascienza', subjects: ['science fiction'] },
	classics: { label: 'Classici', subjects: ['classics', 'classic literature'] },
	dystopia: { label: 'Distopico', subjects: ['dystopias', 'dystopia'] },
	mystery: { label: 'Mistero', subjects: ['mystery', 'detective'] },
	fiction: { label: 'Narrativa', subjects: ['fiction'] },
	romance: { label: 'Romanzo rosa', subjects: ['romance', 'love stories'] },
	thriller: { label: 'Thriller', subjects: ['thriller', 'suspense'] },
	biography: { label: 'Biografie', subjects: ['biography', 'autobiography'] },
	history: { label: 'Storia', subjects: ['history', 'historical fiction'] },
	horror: { label: 'Horror', subjects: ['horror'] },
	poetry: { label: 'Poesia', subjects: ['poetry'] },
	adventure: { label: 'Avventura', subjects: ['adventure', 'adventure stories'] },
	space: { label: 'Spazio', subjects: ['outer space', 'space opera'] },
	mythology: { label: 'Mitologia', subjects: ['mythology'] },
	philosophy: { label: 'Filosofia', subjects: ['philosophy'] },
	humor: { label: 'Umorismo', subjects: ['humor'] },
	children: { label: 'Per ragazzi', subjects: ['juvenile fiction', 'young adult fiction'] }
} as const satisfies Record<string, { label: string; subjects: readonly string[] }>;

export type DiscoverTopic = keyof typeof DISCOVER_TOPICS;

export const DISCOVER_TOPIC_KEYS = Object.keys(DISCOVER_TOPICS) as DiscoverTopic[];

/** Chip principali in alto; gli altri temi stanno sotto "Altro". */
export const MAIN_TOPICS: readonly DiscoverTopic[] = [
	'fantasy',
	'scifi',
	'classics',
	'dystopia',
	'mystery',
	'fiction',
	'romance',
	'thriller',
	'biography',
	'history'
];

/** Dai generi della libreria ai temi per i consigli. */
export const GENRE_TOPICS: Record<GenreSlug, DiscoverTopic[]> = {
	classics: ['classics'],
	'mythology-epic-retelling': ['mythology'],
	'dystopia-scifi': ['dystopia', 'scifi'],
	'thriller-mystery': ['thriller', 'mystery'],
	'fantasy-magical-gothic': ['fantasy'],
	'romance-ya-na': ['romance'],
	'contemporary-historical': ['fiction', 'history'],
	essays: ['biography', 'history', 'philosophy']
};

export const DISCOVER_SECTIONS = [
	'recommended',
	'new',
	'classics',
	'popular',
	'trending',
	'search'
] as const;
export type DiscoverSection = (typeof DISCOVER_SECTIONS)[number];

export const DISCOVER_SORTS = ['relevance', 'readinglog', 'rating', 'new', 'trending'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const DISCOVER_LANGUAGES = {
	all: 'Tutte',
	it: 'Italiano',
	en: 'Inglese',
	fr: 'Francese',
	es: 'Spagnolo',
	de: 'Tedesco'
} as const;
export type DiscoverLanguage = keyof typeof DISCOVER_LANGUAGES;

export const MIN_YEAR = 1800;

const csv = z
	.string()
	.trim()
	.max(400)
	.transform((value) => value.split(',').filter(Boolean));

export const discoverQuerySchema = z.object({
	section: z.enum(DISCOVER_SECTIONS).default('search'),
	q: z.string().trim().max(200).default(''),
	topics: csv
		.pipe(z.array(z.enum(DISCOVER_TOPIC_KEYS as [DiscoverTopic, ...DiscoverTopic[]])).max(12))
		.default([]),
	minRating: z.coerce.number().min(0).max(5).default(0),
	from: z.coerce.number().int().min(0).max(3000).optional(),
	to: z.coerce.number().int().min(0).max(3000).optional(),
	lang: z
		.enum(Object.keys(DISCOVER_LANGUAGES) as [DiscoverLanguage, ...DiscoverLanguage[]])
		.default('it'),
	cover: z
		.enum(['0', '1'])
		.default('0')
		.transform((value) => value === '1'),
	sort: z.enum(DISCOVER_SORTS).default('relevance'),
	page: z.coerce.number().int().min(1).max(50).default(1),
	limit: z.coerce.number().int().min(1).max(40).default(18)
});

export type DiscoverQuery = z.output<typeof discoverQuerySchema>;
/** Richiesta del browser a /api/discover (temi come elenco, copertina come booleano). */
export type DiscoverRequest = Omit<z.input<typeof discoverQuerySchema>, 'topics' | 'cover'> & {
	topics?: DiscoverTopic[];
	cover?: boolean;
};

export const discoverResponseSchema = z.object({
	books: z.array(discoverBookSchema),
	total: z.number().int().nonnegative(),
	hasMore: z.boolean()
});

export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;

/** Candidato per la bozza di aggiunta: i dati dell'edizione arrivano dopo, da BookInfo. */
export function discoverCandidate(book: DiscoverBook): EditionCandidate {
	return {
		provider: 'open-library',
		providerIds: {
			openLibraryWorkId: book.workId,
			openLibraryEditionId: book.editionId,
			googleBooksId: null
		},
		workTitle: book.workTitle,
		editionTitle: book.title,
		authors: book.authors.length > 0 ? book.authors : ['Autore sconosciuto'],
		isbn10: null,
		isbn13: null,
		language: book.language,
		publisher: null,
		publishedDate: book.year ? String(book.year) : null,
		pageCount: null,
		coverUrl: book.coverUrl,
		confidence: 0,
		matchReasons: []
	};
}

/** Chiave per riconoscere un libro già in libreria (titolo + primo cognome dell'autore). */
export function ownedKey(title: string, author: string): string {
	const surname = textKey(author).split(' ').filter(Boolean).pop() ?? '';
	return `${textKey(title)}|${surname}`;
}

/** I libri in libreria si riconoscono dal titolo dell'opera o da quello dell'edizione. */
export function findOwned(book: DiscoverBook, owned: ReadonlyMap<string, string>): string | null {
	for (const author of book.authors.slice(0, 2)) {
		for (const title of [book.title, book.workTitle]) {
			const id = owned.get(ownedKey(title, author));
			if (id) return id;
		}
	}
	return null;
}

/** Filtri di Esplora (stato della pagina). */
export interface DiscoverFilters {
	topics: DiscoverTopic[];
	minRating: number;
	from: number;
	to: number;
	lang: DiscoverLanguage;
	cover: boolean;
}

export function defaultFilters(currentYear: number): DiscoverFilters {
	return { topics: [], minRating: 0, from: MIN_YEAR, to: currentYear, lang: 'it', cover: false };
}

/** Quanti filtri differiscono da quelli di partenza (per il pulsante "Filtri" su mobile). */
export function activeFilterCount(filters: DiscoverFilters, currentYear: number): number {
	const base = defaultFilters(currentYear);
	return (
		filters.topics.length +
		Number(filters.minRating !== base.minRating) +
		Number(filters.from !== base.from || filters.to !== base.to) +
		Number(filters.lang !== base.lang) +
		Number(filters.cover !== base.cover)
	);
}
