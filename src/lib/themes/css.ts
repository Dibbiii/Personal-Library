import { genreSlugSchema, type GenreSlug } from '../contracts/enums';
import type { ThemeDefinition } from '../contracts/themes';
import { builtinThemes, DEFAULT_THEME_KEY } from './registry';
import { themeToCssVariables } from './to-css';

function declarations(vars: Record<string, string>): string {
	return Object.entries(vars)
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
}

/** Un blocco di CSS custom properties per il tema, attivo con data-theme="<id>". */
export function themeToCssBlock(theme: ThemeDefinition): string {
	const selector =
		theme.id === DEFAULT_THEME_KEY
			? `:root,:root[data-theme="${theme.id}"]`
			: `:root[data-theme="${theme.id}"]`;
	return `${selector}{${declarations(themeToCssVariables(theme))}}`;
}

/** Regole [data-genre] che valorizzano --genre-current* a partire dalle variabili per slug. */
export function genreContextCss(slugs: readonly GenreSlug[] = genreSlugSchema.options): string {
	return slugs
		.map(
			(slug) =>
				`[data-genre="${slug}"]{` +
				`--genre-current:var(--genre-${slug});` +
				`--genre-current-light:var(--genre-${slug}-light);` +
				`--genre-current-dark:var(--genre-${slug}-dark);` +
				`--genre-current-on:var(--genre-${slug}-on-base);` +
				`--genre-current-on-light:var(--genre-${slug}-on-light)}`
		)
		.join('');
}

/** CSS inline per l'head del documento: tutti i temi built-in più il contesto genere. */
export function builtinThemesCss(): string {
	return Object.values(builtinThemes).map(themeToCssBlock).join('') + genreContextCss();
}
