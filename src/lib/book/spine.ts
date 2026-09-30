/**
 * Dorsi e cover generate via CSS: algoritmo deterministico (docs/mockup/SPINES.md, spine-algorithm.ts).
 *
 * Nessun colore letterale: le tonalita' escono come espressioni CSS sui token del genere
 * (`var(--genre-<slug>)`, `color-mix(...)`). Le uniche misure sui colori reali servono a scegliere
 * l'inchiostro (bianco/scuro) per contrasto e arrivano dal tema (vedi `palette.ts`).
 */
import type { BookFormat, GenreSlug } from '$lib/contracts';

export type SpineTone = 'base' | 'light' | 'shade' | 'deep';
export type CoverPattern = 'stripes' | 'circle' | 'band-bottom' | 'band-mid' | 'plain';
export type Ink = 'light' | 'dark';
export type BookStatusBadge = 'reading' | 'next';

export const SPINE_WIDTHS = [24, 28, 32, 36] as const;
export const SPINE_HEIGHTS = [110, 116, 122, 128, 134] as const;
const TONES = ['base', 'base', 'light', 'shade', 'deep'] as const;
const PATTERNS = ['stripes', 'circle', 'band-bottom', 'band-mid'] as const;

/** Colori reali (#RRGGBB) necessari solo a misurare il contrasto dell'inchiostro. */
export interface SpineColorSource {
	base: string;
	dark: string;
	/** `onGenreWhite` del tema. */
	white: string;
	/** `onGenreInk` del tema. */
	ink: string;
	/** Colore verso cui scurire la tonalita' "shade" (nel mockup nero puro, nel tema `shadow`). */
	shadow: string;
}

export interface SpineInput {
	bookId: string;
	title: string;
	author: string;
	genre: GenreSlug;
	pages?: number | null;
	format: BookFormat;
	status?: BookStatusBadge | null;
}

export interface SpineSpec {
	spine: {
		width: (typeof SPINE_WIDTHS)[number];
		height: (typeof SPINE_HEIGHTS)[number];
		tone: SpineTone;
		/** Espressione CSS (token del genere). */
		background: string;
		ink: Ink;
		lean: boolean;
		/** Altezza massima del titolo verticale: height - 52. */
		labelMaxHeight: number;
	};
	cover: {
		pattern: CoverPattern;
		tone: SpineTone;
		background: string;
		ink: Ink;
	};
	/** Puo' essere mostrato di fronte anche senza status (libro "evidenziato"). */
	featured: boolean;
	renderAs: 'cover' | 'spine';
	badge: 'In lettura' | 'Prossimo' | null;
}

// ---------- hash e PRNG ----------------------------------------------------------

/** FNV-1a 32 bit. */
export function fnv1a(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
}

/** mulberry32: PRNG seedabile, restituisce valori in [0, 1). */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ---------- colore ---------------------------------------------------------------

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
	const value = hex.replace('#', '');
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value;
	return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function toHex(channels: number[]): string {
	return (
		'#' +
		channels
			.map((v) =>
				Math.max(0, Math.min(255, Math.floor(v + 0.5)))
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

/** Interpolazione lineare in sRGB (come `color-mix(in srgb, ...)`). `t` e' la quota di `b`. */
export function mix(a: string, b: string, t: number): string {
	const x = parseHex(a);
	const y = parseHex(b);
	return toHex(x.map((v, i) => v + ((y[i] ?? 0) - v) * t));
}

function channel(v: number): number {
	const s = v / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
	const [r, g, b] = parseHex(hex);
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
	const x = luminance(a);
	const y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Dorso: bianco o inchiostro scuro, quello col contrasto WCAG maggiore. */
export function pickInk(background: string, white: string, dark: string): Ink {
	return contrast(background, white) > contrast(background, dark) ? 'light' : 'dark';
}

/** Cover frontali: bianco finche' la luminanza relativa e' < 0.40, scuro oltre. */
export function pickCoverInk(background: string): Ink {
	return luminance(background) < 0.4 ? 'light' : 'dark';
}

/** Le quattro tonalita' come colori reali (per il contrasto). */
export function toneColors(source: SpineColorSource): Record<SpineTone, string> {
	return {
		base: source.base,
		light: mix(source.base, source.white, 0.16),
		shade: mix(source.base, source.shadow, 0.14),
		deep: mix(source.base, source.dark, 0.3)
	};
}

/** Le quattro tonalita' come espressioni CSS sui token del genere (nessun letterale). */
export function toneCss(genre: GenreSlug, tone: SpineTone): string {
	const base = `var(--genre-${genre})`;
	switch (tone) {
		case 'base':
			return base;
		case 'light':
			return `color-mix(in srgb, ${base} 84%, var(--color-on-genre-white))`;
		case 'shade':
			return `color-mix(in srgb, ${base} 86%, var(--color-shadow))`;
		case 'deep':
			return `color-mix(in srgb, ${base} 70%, var(--genre-${genre}-dark))`;
	}
}

// ---------- algoritmo ------------------------------------------------------------

function pagesBucket(pages?: number | null): number {
	if (!pages) return 1;
	if (pages < 200) return 0;
	if (pages < 350) return 1;
	if (pages < 500) return 2;
	return 3;
}

function pick<T>(list: readonly T[], value: number): T {
	return list[Math.min(list.length - 1, Math.floor(value * list.length))] as T;
}

export function spineSeed(
	input: Pick<SpineInput, 'bookId' | 'title' | 'author' | 'genre'>
): number {
	return fnv1a(`${input.bookId}|${input.title}|${input.author}|${input.genre}`);
}

export function buildSpine(input: SpineInput, colors: SpineColorSource): SpineSpec {
	const r = rng(spineSeed(input));

	const widthJitter = Math.floor(r() * 3) - 1;
	const widthIndex = Math.max(0, Math.min(3, pagesBucket(input.pages) + widthJitter));
	const height = pick(SPINE_HEIGHTS, r());
	const tone = pick(TONES, r());
	const lean = r() < 0.06;
	const pattern = pick(PATTERNS, r());
	const coverTone: SpineTone = r() < 0.75 ? 'base' : r() < 0.5 ? 'light' : 'shade';
	const featured = r() < 0.08;

	const palette = toneColors(colors);

	return {
		spine: {
			width: SPINE_WIDTHS[widthIndex] as (typeof SPINE_WIDTHS)[number],
			height,
			tone,
			background: toneCss(input.genre, tone),
			ink: pickInk(palette[tone], colors.white, colors.ink),
			lean,
			labelMaxHeight: height - 52
		},
		cover: {
			pattern,
			tone: coverTone,
			background: toneCss(input.genre, coverTone),
			ink: pickCoverInk(palette[coverTone])
		},
		featured,
		renderAs: input.status || featured ? 'cover' : 'spine',
		badge: input.status === 'reading' ? 'In lettura' : input.status === 'next' ? 'Prossimo' : null
	};
}
