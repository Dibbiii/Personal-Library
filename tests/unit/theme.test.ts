import { describe, expect, it } from 'vitest';
import { genreSlugSchema, themeDefinitionSchema } from '../../src/lib/contracts';
import {
	builtinThemes,
	builtinThemesCss,
	DEFAULT_THEME_KEY,
	genreContextCss,
	resolveBuiltinTheme,
	themeToCssBlock,
	themeToCssVariables
} from '../../src/lib/themes';

function luminance(hex: string): number {
	const channels = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

describe('temi built-in', () => {
	it('sono definizioni valide', () => {
		for (const theme of Object.values(builtinThemes)) {
			expect(() => themeDefinitionSchema.parse(theme)).not.toThrow();
		}
	});

	it('risolvono un tema sconosciuto sul default', () => {
		expect(resolveBuiltinTheme('non-esiste').id).toBe(DEFAULT_THEME_KEY);
		expect(resolveBuiltinTheme(undefined).id).toBe(DEFAULT_THEME_KEY);
	});

	it('espongono i token semantici e uno per ogni genere', () => {
		const vars = themeToCssVariables(resolveBuiltinTheme(DEFAULT_THEME_KEY));
		for (const name of [
			'--color-background',
			'--color-surface',
			'--color-surface-elevated',
			'--color-text-primary',
			'--color-primary',
			'--color-on-primary',
			'--color-overlay',
			'--color-icon-muted'
		]) {
			expect(vars).toHaveProperty([name]);
		}
		for (const slug of genreSlugSchema.options) {
			expect(vars).toHaveProperty([`--genre-${slug}`]);
			expect(vars).toHaveProperty([`--genre-${slug}-on-base`]);
		}
	});

	it('generano CSS con selettore per tema e regole di contesto genere', () => {
		const block = themeToCssBlock(resolveBuiltinTheme(DEFAULT_THEME_KEY));
		expect(block).toContain(':root[data-theme="segnalibro"]');
		expect(genreContextCss(['classics'])).toContain('--genre-current:var(--genre-classics)');
		expect(builtinThemesCss()).toContain('[data-genre="romance-ya-na"]');
	});

	it('Beige è una palette e non una modalità', () => {
		expect(resolveBuiltinTheme('beige').name).toBe('Beige legno');
		const css = builtinThemesCss();
		expect(css).toContain(':root[data-theme="beige"]');
		expect(css).not.toContain('data-appearance="beige"');
	});

	it('la modalità scura mantiene la tinta della palette selezionata', () => {
		for (const theme of Object.values(builtinThemes)) {
			expect(themeToCssVariables(theme)['--color-palette-primary']).toBe(theme.colors.primary);
		}
		const css = builtinThemesCss();
		expect(css).toContain('var(--color-palette-primary)');
		expect(css).toContain(':root[data-appearance="dark"]');
		expect(css).toContain('@media(prefers-color-scheme:dark)');
		expect(css).toContain(':root[data-appearance="system"]');
	});
});

describe('contrasto WCAG AA (testo normale)', () => {
	const theme = resolveBuiltinTheme(DEFAULT_THEME_KEY);
	const { colors } = theme;

	const pairs: [string, string, string][] = [
		['testo su sfondo', colors.textPrimary, colors.background],
		['testo su surface', colors.textPrimary, colors.surface],
		['testo secondario su sfondo', colors.textSecondary, colors.background],
		['testo secondario su surface', colors.textSecondary, colors.surface],
		['testo muted su sfondo', colors.textMuted, colors.background],
		['on-primary su primary', colors.onPrimary, colors.primary],
		['on-secondary su secondary', colors.onSecondary, colors.secondary],
		['on-accent su accent', colors.onAccent, colors.accent],
		['on-success', colors.onSuccess, colors.success],
		['on-warning', colors.onWarning, colors.warning],
		['on-danger', colors.onDanger, colors.danger],
		['on-info', colors.onInfo, colors.info],
		['primary su sfondo', colors.primary, colors.background],
		['primary-deep su surface', colors.primaryDeep, colors.surface],
		['info su sfondo', colors.info, colors.background],
		['shelf-axis su sfondo', colors.shelfAxis, colors.background],
		['wood-ink su wood-mid', colors.woodInk, colors.woodMid]
	];

	for (const [name, fg, bg] of pairs) {
		it(name, () => {
			expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
		});
	}

	for (const slug of genreSlugSchema.options) {
		const palette = theme.genres[slug];
		it(`genere ${slug}`, () => {
			expect(contrast(palette.onBase, palette.base)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(palette.onLight, palette.light)).toBeGreaterThanOrEqual(4.5);
		});
	}
});
