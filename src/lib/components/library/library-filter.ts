import type { BookSummary } from '$lib/contracts';

export type LibrarySort = 'recent' | 'title' | 'author' | 'rating';
export type LibraryView = 'grid' | 'list';

export const SORT_OPTIONS: readonly { value: LibrarySort; label: string }[] = [
	{ value: 'recent', label: 'Più recenti' },
	{ value: 'title', label: 'Titolo A–Z' },
	{ value: 'author', label: 'Autore A–Z' },
	{ value: 'rating', label: 'Voto' }
];

export function isLibrarySort(value: unknown): value is LibrarySort {
	return SORT_OPTIONS.some((option) => option.value === value);
}

/** Minuscole e senza accenti: "Odissea" trova "odissèa". */
export function normalizeQuery(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Titolo, autore, genere o serie contengono la ricerca (gia' normalizzata). */
export function matchesQuery(book: BookSummary, query: string): boolean {
	if (!query) return true;
	const fields = [book.title, book.author, book.genre.name, book.series?.name ?? ''];
	return fields.some((field) => normalizeQuery(field).includes(query));
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** `recent` mantiene l'ordine della libreria (aggiunti di recente prima). */
export function sortBooks(books: readonly BookSummary[], sort: LibrarySort): BookSummary[] {
	const list = [...books];
	if (sort === 'title') list.sort((a, b) => collator.compare(a.title, b.title));
	else if (sort === 'author')
		list.sort((a, b) => collator.compare(a.author, b.author) || collator.compare(a.title, b.title));
	else if (sort === 'rating')
		list.sort(
			(a, b) => (b.reviewRating ?? 0) - (a.reviewRating ?? 0) || collator.compare(a.title, b.title)
		);
	return list;
}
