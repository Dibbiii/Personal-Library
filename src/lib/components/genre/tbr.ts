import type { BookSummary } from '$lib/contracts';

/** I libri da leggere non hanno ancora un voto: niente ordinamento per voto. */
export type TbrSortField = 'title' | 'author' | 'pages' | 'date';
export type TbrView = 'grid' | 'list';

export const TBR_SORT_FIELDS: readonly { field: TbrSortField; label: string }[] = [
	{ field: 'title', label: 'Titolo' },
	{ field: 'author', label: 'Autore' },
	{ field: 'pages', label: 'Pagine' },
	{ field: 'date', label: 'Aggiunti' }
];

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

function lastWord(author: string): string {
	const words = author.trim().split(/\s+/);
	return words[words.length - 1] ?? author;
}

/** Ordina una copia dei libri; la data è quella di ultima attività (più recente prima). */
export function sortTbr(books: readonly BookSummary[], field: TbrSortField): BookSummary[] {
	const sorted = [...books];
	switch (field) {
		case 'title':
			return sorted.sort((a, b) => collator.compare(a.title, b.title));
		case 'author':
			return sorted.sort(
				(a, b) =>
					collator.compare(lastWord(a.author), lastWord(b.author)) ||
					collator.compare(a.title, b.title)
			);
		case 'pages':
			return sorted.sort(
				(a, b) =>
					(a.pageCount ?? Number.MAX_SAFE_INTEGER) - (b.pageCount ?? Number.MAX_SAFE_INTEGER) ||
					collator.compare(a.title, b.title)
			);
		case 'date':
			return sorted.sort(
				(a, b) =>
					(b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') ||
					collator.compare(a.title, b.title)
			);
	}
}

export function captionFor(field: TbrSortField): string {
	return `per ${TBR_SORT_FIELDS.find((item) => item.field === field)?.label.toLowerCase() ?? field}`;
}
