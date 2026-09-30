import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SORT,
	nextSortQuery,
	parseGenreSort,
	sortCaption
} from '../../src/lib/components/genre/sort';

describe('ordinamento della vista genere', () => {
	it('senza parametri vale il default del mockup (voto, dal più alto)', () => {
		expect(parseGenreSort(new URLSearchParams())).toEqual(DEFAULT_SORT);
	});

	it('legge campo e direzione dall URL', () => {
		expect(parseGenreSort(new URLSearchParams('sort=title&dir=desc'))).toEqual({
			field: 'title',
			direction: 'desc'
		});
	});

	it('usa la direzione naturale del campo se manca o è invalida', () => {
		expect(parseGenreSort(new URLSearchParams('sort=pages'))).toEqual({
			field: 'pages',
			direction: 'asc'
		});
		expect(parseGenreSort(new URLSearchParams('sort=date&dir=boh')).direction).toBe('desc');
	});

	it('valori sconosciuti ricadono sul default, senza errore', () => {
		expect(parseGenreSort(new URLSearchParams('sort=prezzo&dir=asc'))).toEqual(DEFAULT_SORT);
	});

	it('il secondo tocco sullo stesso chip inverte la direzione', () => {
		expect(nextSortQuery({ field: 'rating', direction: 'desc' }, 'rating')).toBe(
			'?sort=rating&dir=asc'
		);
		expect(nextSortQuery({ field: 'rating', direction: 'desc' }, 'title')).toBe(
			'?sort=title&dir=asc'
		);
	});

	it('didascalie: Letti con direzione, TBR solo il campo', () => {
		const sort = { field: 'rating', direction: 'desc' } as const;
		expect(sortCaption(sort, true)).toBe('per voto, dal più alto');
		expect(sortCaption(sort, false)).toBe('per voto');
	});
});
