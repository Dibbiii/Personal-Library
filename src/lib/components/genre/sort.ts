import type { GenreSortField, SortDirection } from '$lib/contracts/enums';
import { genreSortFieldSchema, sortDirectionSchema } from '$lib/contracts/enums';

export interface GenreSort {
	field: GenreSortField;
	direction: SortDirection;
}

export const SORT_FIELDS: readonly { field: GenreSortField; label: string }[] = [
	{ field: 'title', label: 'Titolo' },
	{ field: 'author', label: 'Autore' },
	{ field: 'pages', label: 'Pagine' },
	{ field: 'rating', label: 'Voto' },
	{ field: 'date', label: 'Data' }
];

/** Come nel mockup 02 la vista si apre ordinata per voto, dal più alto. */
export const DEFAULT_SORT: GenreSort = { field: 'rating', direction: 'desc' };

/** Direzione naturale di un campo quando lo si seleziona per la prima volta. */
export const DEFAULT_DIRECTION: Record<GenreSortField, SortDirection> = {
	title: 'asc',
	author: 'asc',
	pages: 'asc',
	rating: 'desc',
	date: 'desc'
};

/** Legge `?sort=&dir=`; valori sconosciuti ricadono sul default (mai errore). */
export function parseGenreSort(params: URLSearchParams): GenreSort {
	const field = genreSortFieldSchema.safeParse(params.get('sort'));
	if (!field.success) return DEFAULT_SORT;
	const direction = sortDirectionSchema.safeParse(params.get('dir'));
	return {
		field: field.data,
		direction: direction.success ? direction.data : DEFAULT_DIRECTION[field.data]
	};
}

/** Query string per un nuovo ordinamento: stesso campo = inverte la direzione. */
export function nextSortQuery(current: GenreSort, field: GenreSortField): string {
	const direction: SortDirection =
		field === current.field
			? current.direction === 'asc'
				? 'desc'
				: 'asc'
			: DEFAULT_DIRECTION[field];
	return `?sort=${field}&dir=${direction}`;
}

const DESCRIPTIONS: Record<GenreSortField, Record<SortDirection, string>> = {
	title: { asc: 'dalla A alla Z', desc: 'dalla Z alla A' },
	author: { asc: 'dalla A alla Z', desc: 'dalla Z alla A' },
	pages: { asc: 'dal più corto', desc: 'dal più lungo' },
	rating: { asc: 'dal più basso', desc: 'dal più alto' },
	date: { asc: 'dal meno recente', desc: 'dal più recente' }
};

const FIELD_NAMES: Record<GenreSortField, string> = {
	title: 'titolo',
	author: 'autore',
	pages: 'pagine',
	rating: 'voto',
	date: 'data'
};

/** "per voto, dal più alto" (Letti) oppure solo "per voto" (Da leggere), come nel mockup. */
export function sortCaption(sort: GenreSort, withDirection: boolean): string {
	const base = `per ${FIELD_NAMES[sort.field]}`;
	return withDirection ? `${base}, ${DESCRIPTIONS[sort.field][sort.direction]}` : base;
}
