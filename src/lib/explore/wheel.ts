/**
 * Logica pura della Ruota della Fortuna: layout degli spicchi, scelta pseudo-casuale
 * (crypto) e calcolo dell'angolo finale. Nessun accesso al DOM.
 *
 * Convenzione angoli: gradi in senso orario a partire dall'asse +x dell'SVG (ore 3),
 * quindi ore 6 = 90, ore 9 = 180, ore 12 = 270. La rotazione della ruota (CSS `rotate`)
 * segue lo stesso verso.
 */
import type { BookSummary } from '../contracts/books';
import type { GenreSlug } from '../contracts/enums';
import { GENRE_ORDER } from '../genres';

/** Massimo di spicchi disegnati: oltre la ruota diventa illeggibile. */
export const MAX_WHEEL_SLICES = 12;

/** Angolo del puntatore (in alto) nel sistema di riferimento della ruota. */
export const POINTER_ANGLE = 270;

export const WHEEL_CENTER = 170;
export const WHEEL_SLICE_RADIUS = 148;
export const WHEEL_LABEL_RADIUS = 134;

/** Sorgente di interi casuali in [0, max). Iniettabile per i test. */
export type RandomInt = (max: number) => number;

/** Intero uniforme in [0, max) con `crypto.getRandomValues` (rejection sampling, niente bias). */
export const cryptoRandomInt: RandomInt = (max) => {
	if (!Number.isInteger(max) || max <= 0) throw new RangeError('max deve essere un intero > 0');
	if (max === 1) return 0;
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	const buffer = new Uint32Array(1);
	for (;;) {
		crypto.getRandomValues(buffer);
		const value = buffer[0] ?? 0;
		if (value < limit) return value % max;
	}
};

const mod = (value: number, base: number) => ((value % base) + base) % base;

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

export function sliceSpan(count: number): number {
	return 360 / count;
}

/**
 * Con rotazione 0 lo spicchio 0 parte da "ore 6" verso sinistra (come nel mockup: con 10
 * spicchi quello in alto centrato è il 5°).
 */
export function sliceStartAngle(index: number, count: number): number {
	const span = sliceSpan(count);
	return 90 + span / 2 + index * span;
}

export function sliceCenterAngle(index: number, count: number): number {
	return sliceStartAngle(index, count) + sliceSpan(count) / 2;
}

export function polar(radius: number, degrees: number, center = WHEEL_CENTER) {
	const rad = (degrees * Math.PI) / 180;
	return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Path SVG dello spicchio; `null` quando c'è un solo spicchio (si disegna un cerchio). */
export function slicePath(
	index: number,
	count: number,
	radius = WHEEL_SLICE_RADIUS
): string | null {
	if (count < 2) return null;
	const start = sliceStartAngle(index, count);
	const end = start + sliceSpan(count);
	const a = polar(radius, start);
	const b = polar(radius, end);
	const large = sliceSpan(count) > 180 ? 1 : 0;
	const c = WHEEL_CENTER;
	return `M${c} ${c} L${fmt(a.x)} ${fmt(a.y)} A${radius} ${radius} 0 ${large} 1 ${fmt(b.x)} ${fmt(b.y)} Z`;
}

export interface SliceLabelLayout {
	transform: string;
	anchor: 'start' | 'end';
}

/** Etichetta ruotata nel raggio e sempre leggibile (metà sinistra capovolta), come nel mockup. */
export function sliceLabelLayout(index: number, count: number): SliceLabelLayout {
	const center = mod(sliceCenterAngle(index, count), 360);
	const c = WHEEL_CENTER;
	if (center > 90 && center < 270) {
		return {
			transform: `translate(${c} ${c}) rotate(${fmt(center - 180)}) translate(${-WHEEL_LABEL_RADIUS},0)`,
			anchor: 'start'
		};
	}
	const signed = center >= 270 ? center - 360 : center;
	return {
		transform: `translate(${c} ${c}) rotate(${fmt(signed)}) translate(${WHEEL_LABEL_RADIUS},0)`,
		anchor: 'end'
	};
}

/** Titolo abbreviato per lo spicchio: via il sottotitolo, parole intere, ellissi se serve. */
export function shortTitle(title: string, maxChars = 15): string {
	const main = (title.split(/\s*[:–—]\s*|\s+-\s+/)[0] ?? title).trim() || title.trim();
	if (main.length <= maxChars) return main;
	const words = main.split(/\s+/);
	let result = '';
	for (const word of words) {
		const next = result ? `${result} ${word}` : word;
		if (next.length > maxChars) break;
		result = next;
	}
	if (!result) return `${main.slice(0, maxChars - 1).trimEnd()}…`;
	// Niente congiunzioni o preposizioni appese prima dell'ellissi ("La paura del…").
	const trimmed = result.replace(
		/[\s,;&-]+(?:e|ed|a|di|da|del|della|dei|in|il|la|lo|le|un|the|of|and)$/i,
		''
	);
	return `${(trimmed || result).replace(/[\s,;&-]+$/, '')}…`;
}

export function labelFontSize(count: number): number {
	return count <= 10 ? 12.5 : 11.5;
}

export function labelMaxChars(count: number): number {
	return count <= 10 ? 15 : 14;
}

// ---------------------------------------------------------------------------
// Angolo -> spicchio
// ---------------------------------------------------------------------------

/** Indice dello spicchio sotto il puntatore con la ruota ruotata di `rotation` gradi. */
export function sliceIndexAtPointer(rotation: number, count: number): number {
	const span = sliceSpan(count);
	const fromStart = mod(POINTER_ANGLE - rotation - sliceStartAngle(0, count), 360);
	return Math.min(count - 1, Math.floor(fromStart / span));
}

/**
 * Rotazione finale (>= `currentRotation` + `minTurns` giri) che porta lo spicchio `index`
 * sotto il puntatore. `offset` in [-0.5, 0.5] è la posizione dentro lo spicchio
 * (0 = centro) e viene limitata al 70% centrale per non cadere mai sul bordo.
 */
export function rotationForSlice(input: {
	index: number;
	count: number;
	currentRotation: number;
	minTurns: number;
	offset?: number;
}): number {
	const { index, count, currentRotation, minTurns } = input;
	const offset = Math.max(-0.35, Math.min(0.35, input.offset ?? 0));
	const target = mod(
		POINTER_ANGLE - (sliceCenterAngle(index, count) + offset * sliceSpan(count)),
		360
	);
	const delta = mod(target - mod(currentRotation, 360), 360) + Math.max(0, minTurns) * 360;
	return currentRotation + delta;
}

// ---------------------------------------------------------------------------
// Campione di spicchi
// ---------------------------------------------------------------------------

export function shuffle<T>(items: readonly T[], rng: RandomInt): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = rng(i + 1);
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy;
}

const genreOf = (book: BookSummary): GenreSlug => book.genre.slug;

/** Evita, dove possibile, due spicchi adiacenti dello stesso genere (anche tra ultimo e primo). */
function separateNeighbours(books: BookSummary[]): BookSummary[] {
	const result = [...books];
	const n = result.length;
	for (let i = 1; i < n; i++) {
		const prev = result[i - 1] as BookSummary;
		if (genreOf(result[i] as BookSummary) !== genreOf(prev)) continue;
		for (let j = i + 1; j < n; j++) {
			const candidate = result[j] as BookSummary;
			const after = result[i + 1];
			if (
				genreOf(candidate) !== genreOf(prev) &&
				(!after || genreOf(candidate) !== genreOf(after))
			) {
				[result[i], result[j]] = [candidate, result[i] as BookSummary];
				break;
			}
		}
	}
	return result;
}

/**
 * Campione rappresentativo: al massimo `max` libri, presi a turno da ogni genere (così tutti i
 * generi del pool compaiono) e poi mescolati. Sotto il limite restituisce tutto il pool.
 */
export function sampleSlices(pool: readonly BookSummary[], rng: RandomInt, max = MAX_WHEEL_SLICES) {
	if (pool.length === 0) return [];
	const groups = new Map<GenreSlug, BookSummary[]>();
	for (const book of shuffle(pool, rng)) {
		const group = groups.get(genreOf(book));
		if (group) group.push(book);
		else groups.set(genreOf(book), [book]);
	}
	const order = [...groups.keys()].sort((a, b) => GENRE_ORDER.indexOf(a) - GENRE_ORDER.indexOf(b));
	const picked: BookSummary[] = [];
	while (picked.length < Math.min(max, pool.length)) {
		for (const slug of order) {
			const next = groups.get(slug)?.pop();
			if (next) picked.push(next);
			if (picked.length >= max) break;
		}
	}
	return separateNeighbours(shuffle(picked, rng));
}

/** Garantisce che `winner` sia tra gli spicchi, sostituendone uno (preferibilmente dello stesso genere). */
export function ensureIncluded(
	slices: readonly BookSummary[],
	winner: BookSummary,
	rng: RandomInt
): BookSummary[] {
	if (slices.some((b) => b.id === winner.id)) return [...slices];
	const sameGenre = slices
		.map((book, index) => ({ book, index }))
		.filter(({ book }) => genreOf(book) === genreOf(winner));
	const candidates =
		sameGenre.length > 0 ? sameGenre : slices.map((book, index) => ({ book, index }));
	const replaceAt = candidates[rng(candidates.length)]?.index ?? 0;
	const copy = [...slices];
	if (copy.length === 0) return [winner];
	copy[replaceAt] = winner;
	return copy;
}

// ---------------------------------------------------------------------------
// Piano di un giro
// ---------------------------------------------------------------------------

export interface SpinPlan {
	winner: BookSummary;
	slices: BookSummary[];
	winnerIndex: number;
	/** Rotazione finale assoluta della ruota. */
	rotation: number;
	/** Gradi percorsi rispetto alla rotazione di partenza. */
	travel: number;
}

export interface SpinInput {
	pool: readonly BookSummary[];
	slices: readonly BookSummary[];
	currentRotation: number;
	rng?: RandomInt;
	/** Giri completi prima di fermarsi (0 con prefers-reduced-motion). */
	turns?: number;
}

/**
 * Il vincitore è scelto PRIMA, uniformemente su tutto il pool (non solo sugli spicchi visibili);
 * l'angolo finale è calcolato di conseguenza perché il puntatore cada sullo spicchio estratto.
 */
export function planSpin(input: SpinInput): SpinPlan {
	const rng = input.rng ?? cryptoRandomInt;
	const { pool, currentRotation } = input;
	if (pool.length === 0) throw new RangeError('Il pool è vuoto');

	const winner = pool[rng(pool.length)] as BookSummary;
	const slices = ensureIncluded(
		input.slices.length ? input.slices : sampleSlices(pool, rng),
		winner,
		rng
	);
	const winnerIndex = slices.findIndex((b) => b.id === winner.id);
	const offset = (rng(1000) / 1000 - 0.5) * 0.7;
	const rotation = rotationForSlice({
		index: winnerIndex,
		count: slices.length,
		currentRotation,
		minTurns: input.turns ?? 5,
		offset
	});
	return { winner, slices, winnerIndex, rotation, travel: rotation - currentRotation };
}

// ---------------------------------------------------------------------------
// Sorgente deterministica (solo per l'anteprima iniziale, identica su server e client)
// ---------------------------------------------------------------------------

/** FNV-1a a 32 bit. */
export function hashString(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

/** Generatore mulberry32: stesso seme, stessa sequenza. NON usarlo per estrarre il vincitore. */
export function seededRandomInt(seed: number): RandomInt {
	let state = seed >>> 0;
	return (max) => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
	};
}
