import { describe, expect, it } from 'vitest';
import type { BookSummary } from '../../src/lib/contracts/books';
import type { GenreSlug } from '../../src/lib/contracts/enums';
import {
	MAX_WHEEL_SLICES,
	cryptoRandomInt,
	ensureIncluded,
	planSpin,
	rotationForSlice,
	sampleSlices,
	seededRandomInt,
	shortTitle,
	sliceCenterAngle,
	sliceIndexAtPointer,
	sliceLabelLayout,
	slicePath,
	sliceStartAngle
} from '../../src/lib/explore/wheel';
import { GENRE_ORDER } from '../../src/lib/genres';

function book(i: number, slug: GenreSlug = GENRE_ORDER[i % GENRE_ORDER.length] as GenreSlug) {
	return {
		id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
		title: `Libro ${i}`,
		author: 'Autore',
		genre: { id: 1, slug, name: slug }
	} as unknown as BookSummary;
}

const pool = (n: number) => Array.from({ length: n }, (_, i) => book(i));

describe('geometria della ruota', () => {
	it('con 10 spicchi il quinto e in alto al centro come nel mockup', () => {
		expect(sliceStartAngle(0, 10)).toBe(108);
		expect(sliceCenterAngle(4, 10)).toBe(270);
		expect(sliceIndexAtPointer(0, 10)).toBe(4);
	});

	it('sliceIndexAtPointer ruota in senso orario', () => {
		// Ruotando di un passo (36 gradi) in senso orario lo spicchio sotto il puntatore e il precedente.
		expect(sliceIndexAtPointer(36, 10)).toBe(3);
		expect(sliceIndexAtPointer(-36, 10)).toBe(5);
		expect(sliceIndexAtPointer(360 * 7, 10)).toBe(4);
	});

	it('uno spicchio solo non ha path (si disegna un cerchio)', () => {
		expect(slicePath(0, 1)).toBeNull();
		expect(slicePath(0, 10)).toMatch(/^M170 170 L/);
	});

	it('le etichette della meta sinistra sono capovolte e leggibili', () => {
		const left = sliceLabelLayout(0, 10); // centro 126
		expect(left.anchor).toBe('start');
		expect(left.transform).toContain('rotate(-54)');
		const top = sliceLabelLayout(4, 10); // centro 270
		expect(top.anchor).toBe('end');
		expect(top.transform).toContain('rotate(-90)');
	});
});

describe('rotazione finale', () => {
	it.each([1, 2, 3, 7, 10, 12])(
		'il puntatore cade sullo spicchio scelto con %i spicchi',
		(count) => {
			for (let index = 0; index < count; index++) {
				for (const offset of [-0.35, -0.1, 0, 0.2, 0.35]) {
					for (const currentRotation of [0, 123.4, 1800.5, -90]) {
						const rotation = rotationForSlice({
							index,
							count,
							currentRotation,
							minTurns: 5,
							offset
						});
						expect(sliceIndexAtPointer(rotation, count)).toBe(index);
						expect(rotation - currentRotation).toBeGreaterThanOrEqual(5 * 360);
						expect(rotation - currentRotation).toBeLessThan(6 * 360);
					}
				}
			}
		}
	);

	it('senza giri extra percorre meno di un giro (prefers-reduced-motion)', () => {
		const rotation = rotationForSlice({ index: 3, count: 10, currentRotation: 40, minTurns: 0 });
		expect(rotation - 40).toBeLessThan(360);
		expect(sliceIndexAtPointer(rotation, 10)).toBe(3);
	});

	it('limita lo scarto dentro lo spicchio al 70% centrale', () => {
		const rotation = rotationForSlice({
			index: 2,
			count: 8,
			currentRotation: 0,
			minTurns: 1,
			offset: 5
		});
		expect(sliceIndexAtPointer(rotation, 8)).toBe(2);
	});
});

describe('scelta del vincitore e campione', () => {
	it('planSpin ferma il puntatore sul vincitore, scelto fra tutto il pool', () => {
		const all = pool(40);
		const rng = seededRandomInt(42);
		const slices = sampleSlices(all, rng);
		for (let run = 0; run < 200; run++) {
			const plan = planSpin({ pool: all, slices, currentRotation: run * 37.3, rng });
			expect(plan.slices.length).toBeLessThanOrEqual(MAX_WHEEL_SLICES);
			expect(plan.slices[plan.winnerIndex]?.id).toBe(plan.winner.id);
			expect(sliceIndexAtPointer(plan.rotation, plan.slices.length)).toBe(plan.winnerIndex);
			expect(all.map((b) => b.id)).toContain(plan.winner.id);
		}
	});

	it('il vincitore e uniforme sul pool intero (anche fuori dal campione)', () => {
		const all = pool(30);
		const slices = sampleSlices(all, seededRandomInt(1));
		const rng = seededRandomInt(7);
		const wins = new Map<string, number>();
		for (let i = 0; i < 6000; i++) {
			const { winner } = planSpin({ pool: all, slices, currentRotation: 0, rng });
			wins.set(winner.id, (wins.get(winner.id) ?? 0) + 1);
		}
		expect(wins.size).toBe(30);
		for (const count of wins.values()) expect(count).toBeGreaterThan(120); // atteso 200
	});

	it('sotto il limite tutti i libri sono spicchi, sopra ce ne sono al piu 12 e tutti i generi compaiono', () => {
		expect(sampleSlices(pool(5), seededRandomInt(1))).toHaveLength(5);
		const big = sampleSlices(pool(70), seededRandomInt(2));
		expect(big).toHaveLength(MAX_WHEEL_SLICES);
		expect(new Set(big.map((b) => b.genre.slug)).size).toBe(GENRE_ORDER.length);
		expect(new Set(big.map((b) => b.id)).size).toBe(MAX_WHEEL_SLICES);
	});

	it('sampleSlices evita spicchi adiacenti dello stesso genere quando possibile', () => {
		const slices = sampleSlices(pool(12), seededRandomInt(3));
		for (let i = 1; i < slices.length; i++) {
			expect(slices[i]?.genre.slug).not.toBe(slices[i - 1]?.genre.slug);
		}
	});

	it('ensureIncluded sostituisce uno spicchio dello stesso genere', () => {
		const slices = sampleSlices(pool(12), seededRandomInt(5));
		const winner = book(99, slices[0]?.genre.slug);
		const result = ensureIncluded(slices, winner, seededRandomInt(1));
		expect(result).toHaveLength(slices.length);
		const replaced = result.findIndex((b) => b.id === winner.id);
		expect(replaced).toBeGreaterThanOrEqual(0);
		expect(slices[replaced]?.genre.slug).toBe(winner.genre.slug);
	});

	it('un pool vuoto non si puo girare', () => {
		expect(() => planSpin({ pool: [], slices: [], currentRotation: 0 })).toThrow();
	});

	it('cryptoRandomInt resta nell intervallo', () => {
		for (let i = 0; i < 500; i++) {
			const value = cryptoRandomInt(7);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(7);
		}
		expect(cryptoRandomInt(1)).toBe(0);
		expect(() => cryptoRandomInt(0)).toThrow();
	});
});

describe('shortTitle', () => {
	it('toglie il sottotitolo e abbrevia a parole intere', () => {
		expect(shortTitle('Circe')).toBe('Circe');
		expect(shortTitle('Dune: il ciclo completo')).toBe('Dune');
		expect(shortTitle('Fahrenheit 451')).toBe('Fahrenheit 451');
		expect(shortTitle('Assassinio sull’Orient Express')).toBe('Assassinio…');
		expect(shortTitle('La paura del saggio', 12)).toBe('La paura…');
		expect(shortTitle('Supercalifragilistichespiralidoso')).toHaveLength(15);
	});
});
