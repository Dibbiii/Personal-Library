/**
 * Rilegatura dei dorsi sugli scaffali: toni smorzati "da libreria antica" invece del colore pieno del
 * genere, con filetti e un fregio. Deterministica per libro; colori solo come espressioni CSS sui token,
 * i valori reali del tema servono solo a scegliere l'inchiostro per contrasto.
 */
import type { GenreSlug } from '$lib/contracts';
import { resolveBuiltinTheme } from '$lib/themes';
import { contrast, fnv1a, mix, rng } from './spine';

export type BindingVariant = 'muted' | 'deep' | 'dusty' | 'cream' | 'leather';
export type Ornament = 'diamond' | 'leaf' | 'moon' | 'star' | 'dot' | 'none';

export interface Binding {
	variant: BindingVariant;
	/** Espressione CSS del fondo. */
	background: string;
	/** Inchiostro di titolo e fregi: chiaro (crema/oro) o scuro. */
	ink: 'light' | 'dark';
	ornament: Ornament;
	/** Etichetta scura dietro il titolo, come i dorsi in pelle. */
	label: boolean;
}

/** Rilegature "neutre" che compaiono qua e là su ogni scaffale (pelle verde, cotto, marrone, blu, vino). */
const LEATHERS = [
	{ css: 'var(--color-leaf-dark)', key: 'leafDark' },
	{ css: 'var(--color-pot)', key: 'pot' },
	{ css: 'var(--genre-classics-dark)', genre: 'classics' },
	{ css: 'var(--genre-contemporary-historical-dark)', genre: 'contemporary-historical' },
	{ css: 'var(--genre-romance-ya-na-dark)', genre: 'romance-ya-na' }
] as const;

const ORNAMENTS: readonly Ornament[] = ['diamond', 'leaf', 'moon', 'star', 'dot', 'none'];

export function bindingFor(
	book: { id: string; genre: { slug: GenreSlug } },
	themeKey?: string | null
): Binding {
	const theme = resolveBuiltinTheme(themeKey);
	const slug = book.genre.slug;
	const g = theme.genres[slug];
	const cream = theme.colors.woodDetailTop;
	const woodInk = theme.colors.woodInk;
	const r = rng(fnv1a(`binding|${book.id}`));

	const roll = r();
	let variant: BindingVariant;
	let background: string;
	let real: string;
	if (roll < 0.34) {
		variant = 'muted';
		background = `color-mix(in srgb, var(--genre-${slug}) 70%, var(--color-wood-ink))`;
		real = mix(g.base, woodInk, 0.3);
	} else if (roll < 0.6) {
		variant = 'deep';
		background = `color-mix(in srgb, var(--genre-${slug}-dark) 75%, var(--genre-${slug}))`;
		real = mix(g.dark, g.base, 0.25);
	} else if (roll < 0.76) {
		variant = 'dusty';
		background = `color-mix(in srgb, var(--genre-${slug}) 72%, var(--color-wood-detail-top))`;
		real = mix(g.base, cream, 0.28);
	} else if (roll < 0.88) {
		variant = 'cream';
		background = `color-mix(in srgb, var(--color-wood-detail-top) 70%, var(--genre-${slug}-light))`;
		real = mix(cream, g.light, 0.3);
	} else {
		variant = 'leather';
		const leather = LEATHERS[Math.floor(r() * LEATHERS.length)] ?? LEATHERS[0];
		background = leather.css;
		real = 'genre' in leather ? theme.genres[leather.genre].dark : theme.colors[leather.key];
	}

	const ink = contrast(real, cream) >= contrast(real, woodInk) ? 'light' : 'dark';
	const ornament = ORNAMENTS[Math.floor(r() * ORNAMENTS.length)] ?? 'none';
	const label = variant !== 'cream' && r() < 0.3;
	return { variant, background, ink, ornament, label };
}

/** Sugli scaffali i dorsi sono un po' piu' alti della specifica, come nel mockup Libreria. */
export function spineHeight(spec: { spine: { height: number } }): number {
	return Math.round(spec.spine.height * 1.14);
}
