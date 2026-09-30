import type { ThemeDefinition } from '$lib/contracts/themes';
import { themeToCssVariables } from '$lib/themes/to-css';

/** Token principali modificabili nell'editor dei temi custom; gli altri derivano o restano quelli del tema base. */
export const EDITABLE_TOKENS = [
	{ key: 'background', label: 'Sfondo' },
	{ key: 'surface', label: 'Schede' },
	{ key: 'textPrimary', label: 'Testo' },
	{ key: 'primary', label: 'Colore principale' },
	{ key: 'onPrimary', label: 'Testo sul principale' },
	{ key: 'secondary', label: 'Secondario' },
	{ key: 'accent', label: 'Accento' },
	{ key: 'border', label: 'Bordi' }
] as const;

export type EditableTokenKey = (typeof EDITABLE_TOKENS)[number]['key'];
export type MainColors = Record<EditableTokenKey, string>;

function channels(hex: string): [number, number, number] {
	return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
	return (
		'#' +
		[r, g, b]
			.map((value) =>
				Math.round(Math.min(255, Math.max(0, value)))
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
			.toUpperCase()
	);
}

/** Mescola `a` con `b`: ratio 0 = a, 1 = b. */
export function mixHex(a: string, b: string, ratio: number): string {
	const ca = channels(a);
	const cb = channels(b);
	return toHex([
		ca[0] + (cb[0] - ca[0]) * ratio,
		ca[1] + (cb[1] - ca[1]) * ratio,
		ca[2] + (cb[2] - ca[2]) * ratio
	]);
}

/** Schiarisce verso il bianco: ratio 0 = invariato, 1 = bianco. */
export function lighten(hex: string, ratio: number): string {
	const [r, g, b] = channels(hex);
	return toHex([r + (255 - r) * ratio, g + (255 - g) * ratio, b + (255 - b) * ratio]);
}

function luminance(hex: string): number {
	const [r, g, b] = channels(hex).map((value) => {
		const c = value / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto WCAG fra due colori #RRGGBB. */
export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

export function mainColorsOf(theme: ThemeDefinition): MainColors {
	return Object.fromEntries(
		EDITABLE_TOKENS.map(({ key }) => [key, theme.colors[key]])
	) as MainColors;
}

/**
 * Costruisce la definizione a partire dal tema base e dai colori principali scelti.
 * I token legati ai principali (testi secondari, primario profondo, scaffale...) si aggiornano
 * di conseguenza, così il tema resta coerente cambiando pochi colori. Generi e decorazioni
 * restano quelli del tema base.
 */
export function deriveTheme(
	base: ThemeDefinition,
	main: MainColors,
	meta: { id: string; name: string }
): ThemeDefinition {
	return {
		...base,
		schemaVersion: 1,
		id: meta.id,
		name: meta.name,
		colors: {
			...base.colors,
			...main,
			surfaceElevated: lighten(main.background, 0.55),
			textSecondary: mixHex(main.textPrimary, main.background, 0.22),
			textMuted: mixHex(main.textPrimary, main.background, 0.36),
			primarySubtle: main.surface,
			primaryDeep: main.primary,
			onSecondary: base.colors.onSecondary,
			onAccent: main.textPrimary,
			divider: main.border,
			backgroundShelf: mixHex(main.background, main.surface, 0.5),
			sheetHandle: main.border
		}
	};
}

export interface ContrastCheck {
	label: string;
	ratio: number;
	ok: boolean;
}

/** Controlli di leggibilità mostrati nell'editor (AA per testo normale: 4.5). */
export function contrastChecks(theme: ThemeDefinition): ContrastCheck[] {
	const { colors } = theme;
	const pairs: [string, string, string][] = [
		['Testo su sfondo', colors.textPrimary, colors.background],
		['Testo su schede', colors.textPrimary, colors.surface],
		['Testo secondario su sfondo', colors.textSecondary, colors.background],
		['Testo sul principale', colors.onPrimary, colors.primary]
	];
	return pairs.map(([label, fg, bg]) => {
		const ratio = contrastRatio(fg, bg);
		return { label, ratio, ok: ratio >= 4.5 };
	});
}

/** Stringa per l'attributo style di un contenitore: anteprima del tema senza toccare il documento. */
export function themeStyleAttribute(theme: ThemeDefinition): string {
	return Object.entries(themeToCssVariables(theme))
		.map(([name, value]) => `${name}:${value}`)
		.join(';');
}
