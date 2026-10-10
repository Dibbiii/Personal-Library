import type { GenreSlug } from './contracts';

/** Ordine e nomi degli scaffali, come da specifica (sezione 4). */
export const GENRE_ORDER: readonly GenreSlug[] = [
	'classics',
	'mythology-epic-retelling',
	'dystopia-scifi',
	'thriller-mystery',
	'fantasy-magical-gothic',
	'romance-ya-na',
	'contemporary-historical'
];

export const GENRE_LABELS: Record<GenreSlug, string> = {
	classics: 'Classici',
	'mythology-epic-retelling': 'Mitologia, Epica e Retelling',
	'dystopia-scifi': 'Distopia e Fantascienza',
	'thriller-mystery': 'Thriller, Gialli e Mistero',
	'fantasy-magical-gothic': 'Fantasy, Realismo Magico e Gotico',
	'romance-ya-na': 'Romance, Young Adult e New Adult',
	'contemporary-historical': 'Narrativa Contemporanea e Storica'
};

/** Nomi brevi usati nelle legende (calendario, filtri). */
export const GENRE_SHORT_LABELS: Record<GenreSlug, string> = {
	classics: 'Classici',
	'mythology-epic-retelling': 'Mitologia',
	'dystopia-scifi': 'Distopia',
	'thriller-mystery': 'Thriller',
	'fantasy-magical-gothic': 'Fantasy',
	'romance-ya-na': 'Romance',
	'contemporary-historical': 'Contemporanea'
};

export function isGenreSlug(value: string): value is GenreSlug {
	return (GENRE_ORDER as readonly string[]).includes(value);
}

/**
 * Stile inline che punta le variabili del genere corrente a quelle del genere dato.
 * Equivalente all'attributo data-genre, utile quando serve uno scope locale.
 */
export function genreScopeStyle(slug: GenreSlug): string {
	return [
		`--genre-current: var(--genre-${slug})`,
		`--genre-current-light: var(--genre-${slug}-light)`,
		`--genre-current-dark: var(--genre-${slug}-dark)`,
		`--genre-current-on: var(--genre-${slug}-on-base)`,
		`--genre-current-on-light: var(--genre-${slug}-on-light)`,
		`--genre-current-line-top: color-mix(in srgb, var(--genre-${slug}-light) 84%, var(--genre-${slug}-dark))`,
		`--genre-current-line-bottom: color-mix(in srgb, var(--genre-${slug}-light) 66%, var(--genre-${slug}-dark))`
	].join(';');
}
