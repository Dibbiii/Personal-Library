import { describe, expect, it } from 'vitest';
import { genreSlugSchema } from '../../src/lib/contracts';
import { themeDefinitionSchema } from '../../src/lib/contracts/themes';
import {
	updateSettingsInputSchema,
	userExportSchema,
	type ExportBook
} from '../../src/lib/contracts/settings';
import {
	contrastChecks,
	contrastRatio,
	deriveTheme,
	mainColorsOf,
	mixHex
} from '../../src/lib/components/settings/theme-utils';
import { BOOK_CSV_HEADER, booksToCsv, csvCell } from '../../src/lib/server/export/csv';
import { builtinThemes, isBuiltinThemeKey } from '../../src/lib/themes';

function book(overrides: Partial<ExportBook> = {}): ExportBook {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		title: 'Il nome della rosa',
		author: 'Umberto Eco',
		genre: 'classics',
		genreName: 'Classici',
		pageCount: 517,
		language: 'it',
		isbn10: null,
		isbn13: '9788845292613',
		format: 'physical',
		seriesName: null,
		seriesNumber: null,
		seriesTotal: null,
		coverUrl: null,
		hasCustomCover: false,
		source: 'manual',
		lifecycleState: 'finished',
		completedReadingsCount: 2,
		rating: 5,
		lastFinishedAt: '2026-03-01T10:00:00+00:00',
		lastActivityAt: null,
		createdAt: '2026-01-02T08:00:00+00:00',
		tags: ['mistero', 'medioevo'],
		...overrides
	};
}

describe('CSV dei libri', () => {
	it('ha intestazione in italiano, BOM e righe CRLF', () => {
		const csv = booksToCsv([book()]);
		expect(csv.startsWith('﻿')).toBe(true);
		const lines = csv.slice(1).split('\r\n');
		expect(lines[0]).toBe(BOOK_CSV_HEADER.join(','));
		expect(lines[1]).toContain('Il nome della rosa,Umberto Eco,Classici,Cartaceo,517');
		expect(lines[1]).toContain('Letto');
		expect(lines[1]).toContain('mistero; medioevo');
		expect(lines[1]).toContain('2026-03-01');
	});

	it('protegge virgole, virgolette e a capo', () => {
		expect(csvCell('Ciao, mondo')).toBe('"Ciao, mondo"');
		expect(csvCell('Disse "sì"')).toBe('"Disse ""sì"""');
		expect(csvCell('due\nrighe')).toBe('"due\nrighe"');
		expect(csvCell(null)).toBe('');
		expect(csvCell(12)).toBe('12');
	});

	it('neutralizza la formula injection dei fogli di calcolo', () => {
		for (const hostile of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
			expect(csvCell(hostile).replace(/^"/, '').startsWith("'")).toBe(true);
		}
		// I numeri negativi veri (non stringhe) non vengono toccati
		expect(csvCell(-3)).toBe('-3');
	});

	it('con nessun libro produce solo l’intestazione', () => {
		expect(booksToCsv([]).slice(1).split('\r\n').filter(Boolean)).toHaveLength(1);
	});
});

describe('contratti delle impostazioni', () => {
	it('accetta solo modifiche note e non vuote', () => {
		expect(updateSettingsInputSchema.safeParse({ shelfMode: 'covers' }).success).toBe(true);
		expect(updateSettingsInputSchema.safeParse({}).success).toBe(false);
		expect(updateSettingsInputSchema.safeParse({ shelfMode: 'grid' }).success).toBe(false);
		expect(updateSettingsInputSchema.safeParse({ motionPreference: 'off' }).success).toBe(false);
		expect(updateSettingsInputSchema.safeParse({ displayName: '   ' }).success).toBe(false);
		expect(updateSettingsInputSchema.safeParse({ displayName: 'x', extra: 1 }).success).toBe(false);
	});

	it('l’export minimo è valido', () => {
		const minimal = {
			contractVersion: 1,
			format: 'segnalibro-export',
			exportedAt: '2026-09-30T10:00:00Z',
			profile: null,
			preferences: null,
			customThemes: [],
			books: [book()],
			queue: [],
			readings: [],
			progressEvents: [],
			reviews: [],
			quotes: [],
			bingoBoards: []
		};
		expect(userExportSchema.safeParse(minimal).success).toBe(true);
	});
});

describe('temi built-in: contrasto AA per ciascuno', () => {
	for (const theme of Object.values(builtinThemes)) {
		describe(theme.id, () => {
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
				['primary su surface', colors.primary, colors.surface],
				['primary-deep su surface', colors.primaryDeep, colors.surface],
				['info su sfondo', colors.info, colors.background],
				['shelf-axis su sfondo', colors.shelfAxis, colors.background],
				['wood-ink su wood-mid', colors.woodInk, colors.woodMid]
			];
			for (const [name, fg, bg] of pairs) {
				it(name, () => expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5));
			}
			for (const slug of genreSlugSchema.options) {
				it(`genere ${slug}`, () => {
					const palette = theme.genres[slug];
					expect(contrastRatio(palette.onBase, palette.base)).toBeGreaterThanOrEqual(4.5);
					expect(contrastRatio(palette.onLight, palette.light)).toBeGreaterThanOrEqual(4.5);
				});
			}
		});
	}

	it('salvia è registrato e riconosciuto', () => {
		expect(isBuiltinThemeKey('salvia')).toBe(true);
		expect(Object.keys(builtinThemes)).toEqual(expect.arrayContaining(['segnalibro', 'salvia']));
	});
});

describe('editor dei temi custom', () => {
	const base = builtinThemes['segnalibro']!;

	it('partendo da un built-in senza modifiche produce una definizione valida e leggibile', () => {
		const derived = deriveTheme(base, mainColorsOf(base), { id: 'nuovo', name: 'Copia' });
		expect(themeDefinitionSchema.safeParse(derived).success).toBe(true);
		expect(contrastChecks(derived).every((check) => check.ok)).toBe(true);
	});

	it('cambiare i colori principali aggiorna i derivati e resta valido', () => {
		const main = { ...mainColorsOf(base), background: '#101820', textPrimary: '#F2F2F2' };
		const derived = deriveTheme(base, main, { id: 'scuro', name: 'Scuro' });
		expect(themeDefinitionSchema.safeParse(derived).success).toBe(true);
		expect(derived.colors.background).toBe('#101820');
		expect(derived.colors.textSecondary).not.toBe(base.colors.textSecondary);
		expect(derived.colors.onAccent).toBe('#F2F2F2');
	});

	it('segnala i contrasti insufficienti', () => {
		const main = { ...mainColorsOf(base), textPrimary: base.colors.background };
		const derived = deriveTheme(base, main, { id: 'x', name: 'Illeggibile' });
		expect(contrastChecks(derived).some((check) => !check.ok)).toBe(true);
	});

	it('mixHex e contrastRatio si comportano come attesi', () => {
		expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
		expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
	});
});
