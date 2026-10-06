import type { GenreSlug } from '../contracts/enums';
import { isGenreSlug } from '../genres';

export type AddPath = '/add' | '/add/manual' | '/add/search' | '/add/scan';

export function parseAddGenre(value: string | null | undefined): GenreSlug | null {
	return value && isGenreSlug(value) ? value : null;
}

/** Conserva i dati del fallback (ISBN/titolo), ma non propaga generi non validi. */
export function buildAddHref(
	path: AddPath,
	genre: string | null = null,
	searchParams = new URLSearchParams()
): string {
	const params = new URLSearchParams(searchParams);
	const validGenre = parseAddGenre(genre);
	if (validGenre) params.set('genre', validGenre);
	else params.delete('genre');
	const query = params.toString();
	return query ? `${path}?${query}` : path;
}

export function getAddContext(url: URL): { genre: GenreSlug | null; backHref: string } {
	const genre = parseAddGenre(url.searchParams.get('genre'));
	return {
		genre,
		backHref:
			url.pathname === '/add'
				? genre
					? `/genre/${genre}`
					: '/library'
				: buildAddHref('/add', genre)
	};
}
