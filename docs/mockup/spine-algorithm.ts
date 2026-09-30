/**
 * Segnalibro - algoritmo deterministico per i dorsi/cover generati via CSS.
 * Riferimento implementabile (vedi SPINES.md). Nessuna dipendenza, nessun colore letterale:
 * i colori sono SEMPRE letti dalla palette del genere (base/light/dark) passata dal tema.
 *
 * Verificato contro i valori estratti dal mockup (vedi SPINES.md, sezione "Verifica").
 * Node >= 22:  node --experimental-strip-types docs/mockup/spine-algorithm.ts
 */

export type GenreSlug =
  | 'classici' | 'mitologia' | 'distopia' | 'thriller' | 'fantasy' | 'romance' | 'contemporanea';

export interface GenrePalette { base: string; light: string; dark: string } // #RRGGBB dal tema
export type Format = 'physical' | 'digital';
export type CoverPattern = 'stripes' | 'circle' | 'band-bottom' | 'band-mid' | 'plain';
export type Ink = 'light' | 'dark'; // light = testo #FFFFFF ; dark = inchiostro scuro (token --color-on-genre-ink)

export interface SpineInput {
  bookId: string;
  title: string;
  author: string;
  genre: GenreSlug;
  pages?: number | null;
  format: Format;
  status?: 'reading' | 'next' | null; // reading => In lettura, next => Prossimo
}

export interface SpineSpec {
  /** Dorso (libro di costa) */
  spine: {
    width: 24 | 28 | 32 | 36;
    height: 110 | 116 | 122 | 128 | 134;
    tone: 'base' | 'light' | 'shade' | 'deep';
    background: string;      // colore finale #RRGGBB (derivato dalla palette)
    ink: Ink;
    lean: boolean;           // appoggiato (rotate(10deg), transform-origin: bottom right, margin-left 6px)
    labelMaxHeight: number;  // height - 52
  };
  /** Frontale (cover generata) */
  cover: {
    pattern: CoverPattern;
    background: string;
    ink: Ink;
  };
  /** true => lo scaffale puo' mostrarlo di fronte anche senza status (evidenziato) */
  featured: boolean;
  /** Badge e modalita' */
  renderAs: 'cover' | 'spine';
  badge: 'In lettura' | 'Prossimo' | null;
}

// ---------- hash deterministico -------------------------------------------------
/** FNV-1a 32 bit */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/** mulberry32: PRNG seedabile, restituisce [0,1) */
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

// ---------- colore (valori ricavati dal mockup) ---------------------------------
const rgb = (h: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.floor(v + 0.5))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};
const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const luminance = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Inchiostro: sceglie tra bianco e "on-genre-ink" quello col contrasto maggiore (verificato su 22/22 colori del mockup). */
export function pickInk(bg: string, white: string, dark: string): Ink {
  return contrast(bg, white) > contrast(bg, dark) ? 'light' : 'dark';
}

/**
 * Inchiostro delle COVER frontali: regola diversa dai dorsi (verificata su 12/12 cover del mockup).
 * Bianco finche' la luminanza relativa dello sfondo e' < 0.40; scuro oltre (nel mockup: bianco fino a L=0.297,
 * scuro da L=0.470; soglia scelta a meta'). Es.: #C4694A (L=.223) => cover con testi bianchi, ma dorso con inchiostro scuro.
 */
export function pickCoverInk(bg: string): Ink {
  return luminance(bg) < 0.4 ? 'light' : 'dark';
}

/** Le 4 tonalita' del dorso, tutte derivate dalla palette genere. */
export function spineTones(p: GenrePalette) {
  return {
    base: p.base,
    light: mix(p.base, '#FFFFFF', 0.16), // +16% bianco
    shade: mix(p.base, '#000000', 0.14), // x0.86 (nero 14%)
    deep: mix(p.base, p.dark, 0.3),      // 30% verso dark del genere
  };
}

// ---------- pesi -----------------------------------------------------------------
const WIDTHS = [24, 28, 32, 36] as const;
const HEIGHTS = [110, 116, 122, 128, 134] as const;
const TONES = ['base', 'base', 'light', 'shade', 'deep'] as const; // base piu' frequente
const PATTERNS: CoverPattern[] = ['stripes', 'circle', 'band-bottom', 'band-mid'];

function pagesBucket(pages?: number | null): number {
  if (!pages) return 1;
  if (pages < 200) return 0;
  if (pages < 350) return 1;
  if (pages < 500) return 2;
  return 3;
}

export function buildSpine(
  input: SpineInput,
  palette: GenrePalette,
  ink: { white: string; dark: string },
): SpineSpec {
  const seed = fnv1a(`${input.bookId}|${input.title}|${input.author}|${input.genre}`);
  const r = rng(seed);

  const wJitter = Math.floor(r() * 3) - 1; // -1, 0, +1
  const wIdx = Math.max(0, Math.min(3, pagesBucket(input.pages) + wJitter));
  const hIdx = Math.floor(r() * HEIGHTS.length);
  const tone = TONES[Math.floor(r() * TONES.length)];
  const lean = r() < 0.06;                       // ~1 libro appoggiato ogni 15-20 dorsi
  const pattern = PATTERNS[Math.floor(r() * PATTERNS.length)];
  const coverTone = r() < 0.75 ? 'base' : (r() < 0.5 ? 'light' : 'shade');
  const featured = r() < 0.08;

  const tones = spineTones(palette);
  const spineBg = tones[tone];
  const coverBg = tones[coverTone];
  const height = HEIGHTS[hIdx];

  const renderAs: 'cover' | 'spine' = input.status || featured ? 'cover' : 'spine';
  return {
    spine: {
      width: WIDTHS[wIdx],
      height,
      tone,
      background: spineBg,
      ink: pickInk(spineBg, ink.white, ink.dark),
      lean,
      labelMaxHeight: height - 52,
    },
    cover: { pattern, background: coverBg, ink: pickCoverInk(coverBg) },
    featured,
    renderAs,
    badge: input.status === 'reading' ? 'In lettura' : input.status === 'next' ? 'Prossimo' : null,
  };
}

// ---------- demo / self-check -------------------------------------------------------
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('spine-algorithm.ts')) {
  const mitologia: GenrePalette = { base: '#C4694A', light: '#F5DDD2', dark: '#6B301D' };
  console.log(spineTones(mitologia)); // { base:'#c4694a'..., light:'#cd8167', shade:'#a95a40', deep:'#a9583d' }
  const s = buildSpine(
    { bookId: 'b-1', title: 'Circe', author: 'Madeline Miller', genre: 'mitologia', pages: 432, format: 'physical', status: 'next' },
    mitologia, { white: '#FFFFFF', dark: '#23100A' },
  );
  console.log(JSON.stringify(s));
  // Determinismo: stessa chiave => stesso risultato
  const again = buildSpine(
    { bookId: 'b-1', title: 'Circe', author: 'Madeline Miller', genre: 'mitologia', pages: 432, format: 'physical', status: 'next' },
    mitologia, { white: '#FFFFFF', dark: '#23100A' },
  );
  console.log('deterministic:', JSON.stringify(s) === JSON.stringify(again));
}
