import { z } from 'zod';
import { genreSlugSchema } from './enums';
import { uuidSchema } from './primitives';

/**
 * I valori colore sono accettati soltanto nella definizione del tema.
 * Nei componenti/routes vanno usati esclusivamente i CSS custom properties.
 *
 * Per i temi custom V1 limitiamo i colori a #RRGGBB: semplice da validare,
 * serializzare e sicuro. Se in futuro serviranno OKLCH/HSL, si estende qui
 * senza permettere CSS arbitrario.
 */
export const themeColorSchema = z
	.string()
	.regex(/^#[0-9A-Fa-f]{6}$/)
	.transform((value) => value.toUpperCase());

export const semanticThemeColorsSchema = z.object({
	background: themeColorSchema,
	surface: themeColorSchema,
	surfaceElevated: themeColorSchema,

	textPrimary: themeColorSchema,
	textSecondary: themeColorSchema,
	textMuted: themeColorSchema,

	primary: themeColorSchema,
	onPrimary: themeColorSchema,
	primarySubtle: themeColorSchema,

	secondary: themeColorSchema,
	onSecondary: themeColorSchema,

	accent: themeColorSchema,
	onAccent: themeColorSchema,

	border: themeColorSchema,
	divider: themeColorSchema,

	icon: themeColorSchema,
	iconMuted: themeColorSchema,

	shadow: themeColorSchema,
	overlay: themeColorSchema,

	success: themeColorSchema,
	onSuccess: themeColorSchema,
	warning: themeColorSchema,
	onWarning: themeColorSchema,
	danger: themeColorSchema,
	onDanger: themeColorSchema,
	info: themeColorSchema,
	onInfo: themeColorSchema,

	// Estensioni rispetto al baseline v1: colori del mockup senza token nella spec (docs/DEVIATIONS.md).
	primaryDeep: themeColorSchema,
	shelfAxis: themeColorSchema,
	infoHover: themeColorSchema,
	onGenreInk: themeColorSchema,
	onGenreWhite: themeColorSchema,
	sheetHandle: themeColorSchema,

	backgroundShelf: themeColorSchema,
	bingoCard: themeColorSchema,
	graveyardBg: themeColorSchema,
	tombTop: themeColorSchema,
	tombBottom: themeColorSchema,

	woodInk: themeColorSchema,
	woodTop: themeColorSchema,
	woodMid: themeColorSchema,
	woodBottom: themeColorSchema,
	woodDetailTop: themeColorSchema,
	woodDetailMid: themeColorSchema,
	woodDetailBottom: themeColorSchema,

	waxEdge: themeColorSchema,
	flame: themeColorSchema,
	flameCore: themeColorSchema,
	leafDark: themeColorSchema,
	leafLight: themeColorSchema,
	pot: themeColorSchema,
	potRim: themeColorSchema
});

export const genreThemePaletteSchema = z.object({
	base: themeColorSchema,
	light: themeColorSchema,
	dark: themeColorSchema,
	onBase: themeColorSchema,
	onLight: themeColorSchema
});

const exactGenrePaletteShape = Object.fromEntries(
	genreSlugSchema.options.map((slug) => [slug, genreThemePaletteSchema])
) as Record<(typeof genreSlugSchema.options)[number], typeof genreThemePaletteSchema>;

export const themeDefinitionSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().trim().min(1).max(80),
	name: z.string().trim().min(1).max(80),

	colors: semanticThemeColorsSchema,
	genres: z.object(exactGenrePaletteShape)
});

export const themeSelectionSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('builtin'),
		key: z.string().trim().min(1).max(80)
	}),
	z.object({
		kind: z.literal('custom'),
		id: uuidSchema
	})
]);

export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type ThemeSelection = z.infer<typeof themeSelectionSchema>;
