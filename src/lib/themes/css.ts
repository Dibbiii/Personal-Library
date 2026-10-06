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
	return (
		Object.values(builtinThemes).map(themeToCssBlock).join('') + genreContextCss() + appearanceCss()
	);
}

/** La modalità è ortogonale alla palette, anche per i temi custom con variabili inline. */
export function appearanceCss(): string {
	const colors: Record<string, string> = {
		background: 'color-mix(in srgb,var(--color-palette-primary) 10%,#191817)',
		'background-shelf': 'color-mix(in srgb,var(--color-palette-primary) 14%,#211F1C)',
		surface: 'color-mix(in srgb,var(--color-palette-primary) 16%,#302D29)',
		'surface-elevated': 'color-mix(in srgb,var(--color-palette-primary) 18%,#393530)',
		'text-primary': '#F2ECE3',
		'text-secondary': '#D0C5B8',
		'text-muted': '#B0A393',
		primary: 'color-mix(in srgb,var(--color-palette-primary) 35%,#FFFFFF)',
		'on-primary': '#191817',
		'primary-subtle': 'color-mix(in srgb,var(--color-palette-primary) 25%,#302D29)',
		'primary-deep': 'color-mix(in srgb,var(--color-palette-primary) 35%,#FFFFFF)',
		secondary: 'color-mix(in srgb,var(--color-palette-primary) 30%,#FFFFFF)',
		'on-secondary': '#191817',
		border: '#796E62',
		divider: '#62594F',
		icon: '#F2ECE3',
		'icon-muted': '#C0B4A5',
		'nav-inactive': '#D0C5B8',
		info: '#A8C9F4',
		'on-info': '#191817',
		danger: '#F2AAA8',
		'on-danger': '#191817',
		success: '#ABD5AC',
		'on-success': '#191817',
		warning: '#E8C581',
		'on-warning': '#191817',
		overlay: '#080706'
	};
	const vars = Object.fromEntries(
		Object.entries(colors).map(([key, value]) => [`--color-${key}`, `${value}!important`])
	);
	const dark = declarations(vars) + ';color-scheme:dark';
	return (
		`:root[data-appearance="dark"]{${dark}}` +
		`@media(prefers-color-scheme:dark){:root[data-appearance="system"]{${dark}}}`
	);
}
