import { describe, expect, it } from 'vitest';
import {
	SPINE_HEIGHTS,
	SPINE_WIDTHS,
	buildSpine,
	contrast,
	fnv1a,
	mix,
	pickCoverInk,
	pickInk,
	rng,
	toneColors,
	toneCss,
	type SpineColorSource,
	type SpineInput
} from '../../src/lib/book/spine';
import { builtinThemes } from '../../src/lib/themes';
import { genreSlugSchema } from '../../src/lib/contracts/enums';

const theme = builtinThemes['segnalibro']!;

function colorsFor(slug: (typeof genreSlugSchema.options)[number]): SpineColorSource {
	return {
		base: theme.genres[slug].base,
		dark: theme.genres[slug].dark,
		white: theme.colors.onGenreWhite,
		ink: theme.colors.onGenreInk,
		shadow: theme.colors.shadow
	};
}

const input: SpineInput = {
	bookId: 'b-1',
	title: 'Circe',
	author: 'Madeline Miller',
	genre: 'mythology-epic-retelling',
	pages: 432,
	format: 'physical',
	status: 'next'
};

describe('hash e PRNG', () => {
	it('fnv1a e rng sono deterministici', () => {
		expect(fnv1a('segnalibro')).toBe(fnv1a('segnalibro'));
		expect(fnv1a('a')).not.toBe(fnv1a('b'));
		const a = rng(42);
		const b = rng(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('tonalita derivate dal genere (valori del mockup)', () => {
	const mitologia = { base: '#C4694A', dark: '#6B301D', white: '#FFFFFF', shadow: '#000000' };
	const tones = toneColors({ ...mitologia, ink: '#23100A' });

	it('light = +16% bianco, shade = x0.86', () => {
		expect(tones.light).toBe('#cd8167');
		expect(tones.shade).toBe('#a95a40');
		expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
	});

	it('toneCss non contiene colori letterali', () => {
		for (const tone of ['base', 'light', 'shade', 'deep'] as const) {
			const css = toneCss('classics', tone);
			expect(css).toContain('--genre-classics');
			expect(css).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i);
		}
	});
});

describe('buildSpine', () => {
	it('stesso libro, stesso risultato (nessuna dipendenza dall ordine)', () => {
		const first = buildSpine(input, colorsFor(input.genre));
		buildSpine({ ...input, bookId: 'altro' }, colorsFor(input.genre));
		expect(buildSpine(input, colorsFor(input.genre))).toEqual(first);
	});

	it('libri diversi variano', () => {
		const specs = Array.from({ length: 60 }, (_, i) =>
			buildSpine(
				{ ...input, bookId: `id-${i}`, title: `Libro ${i}`, status: null },
				colorsFor(input.genre)
			)
		);
		expect(new Set(specs.map((s) => s.spine.height)).size).toBeGreaterThan(2);
		expect(new Set(specs.map((s) => s.spine.tone)).size).toBeGreaterThan(1);
		expect(new Set(specs.map((s) => s.cover.pattern)).size).toBe(4);
	});

	it('larghezza e altezza restano nei valori del mockup', () => {
		for (let i = 0; i < 200; i++) {
			const pages = [null, 120, 300, 450, 900][i % 5] ?? null;
			const spec = buildSpine(
				{ ...input, bookId: `x${i}`, pages, status: null },
				colorsFor(input.genre)
			);
			expect(SPINE_WIDTHS).toContain(spec.spine.width);
			expect(SPINE_HEIGHTS).toContain(spec.spine.height);
			expect(spec.spine.labelMaxHeight).toBe(spec.spine.height - 52);
		}
	});

	it('piu pagine => dorso mediamente piu largo', () => {
		const avg = (pages: number) => {
			const widths = Array.from(
				{ length: 300 },
				(_, i) =>
					buildSpine({ ...input, bookId: `w${i}`, pages, status: null }, colorsFor(input.genre))
						.spine.width
			);
			return widths.reduce((a, b) => a + b, 0) / widths.length;
		};
		expect(avg(800)).toBeGreaterThan(avg(120));
	});

	it('status => cover con badge; senza status quasi sempre dorso', () => {
		expect(buildSpine(input, colorsFor(input.genre)).renderAs).toBe('cover');
		expect(buildSpine(input, colorsFor(input.genre)).badge).toBe('Prossimo');
		expect(buildSpine({ ...input, status: 'reading' }, colorsFor(input.genre)).badge).toBe(
			'In lettura'
		);
		const plain = Array.from({ length: 200 }, (_, i) =>
			buildSpine({ ...input, bookId: `p${i}`, status: null }, colorsFor(input.genre))
		);
		const covers = plain.filter((s) => s.renderAs === 'cover').length;
		expect(covers).toBeGreaterThan(0);
		expect(covers).toBeLessThan(40);
		expect(plain.every((s) => s.badge === null)).toBe(true);
	});
});

describe('inchiostro', () => {
	it('contrasto >= 3:1 su tutti i generi e tonalita del tema', () => {
		for (const slug of genreSlugSchema.options) {
			const source = colorsFor(slug);
			const tones = toneColors(source);
			for (const tone of Object.values(tones)) {
				const ink = pickInk(tone, source.white, source.ink);
				const fg = ink === 'light' ? source.white : source.ink;
				expect(contrast(tone, fg), `${slug} ${tone}`).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('regole del mockup: dorso Mitologia scuro, cover Mitologia bianca', () => {
		expect(pickInk('#C4694A', '#FFFFFF', '#23100A')).toBe('dark');
		expect(pickInk('#a95a40', '#FFFFFF', '#23100A')).toBe('light');
		expect(pickCoverInk('#C4694A')).toBe('light');
		expect(pickCoverInk('#E0B62B')).toBe('dark');
		expect(pickCoverInk('#86bde2')).toBe('dark');
	});
});
