import type { BookFormat } from '$lib/contracts';

/** "all" = nessun filtro. Un libro posseduto in "entrambi" i formati vale per ciascuno dei due. */
export type WheelFormatFilter = 'all' | 'physical' | 'digital';

export const WHEEL_FORMAT_OPTIONS: readonly { value: WheelFormatFilter; label: string }[] = [
	{ value: 'all', label: 'Tutti' },
	{ value: 'physical', label: 'Cartacei' },
	{ value: 'digital', label: 'Digitali' }
];

export function matchesWheelFormat(book: { format: BookFormat }, filter: WheelFormatFilter) {
	return filter === 'all' || book.format === 'both' || book.format === filter;
}

export function wheelFormatCounts(books: readonly { format: BookFormat }[]) {
	return {
		all: books.length,
		physical: books.filter((book) => matchesWheelFormat(book, 'physical')).length,
		digital: books.filter((book) => matchesWheelFormat(book, 'digital')).length
	} satisfies Record<WheelFormatFilter, number>;
}
