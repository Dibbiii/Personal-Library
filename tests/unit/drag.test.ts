import { describe, expect, it } from 'vitest';
import { edgeScrollDelta, exceedsSlop, findZone, ghostOrigin } from '../../src/lib/actions/drag';

describe('drag: logica pura', () => {
	it('exceedsSlop usa la distanza euclidea', () => {
		expect(exceedsSlop(3, 4, 8)).toBe(false);
		expect(exceedsSlop(6, 6, 8)).toBe(true);
		expect(exceedsSlop(0, 0)).toBe(false);
	});

	it('edgeScrollDelta: zero al centro, cresce verso i bordi', () => {
		expect(edgeScrollDelta(400, 0, 800)).toBe(0);
		expect(edgeScrollDelta(0, 0, 800)).toBe(-18);
		expect(edgeScrollDelta(800, 0, 800)).toBe(18);
		expect(Math.abs(edgeScrollDelta(60, 0, 800))).toBeLessThan(
			Math.abs(edgeScrollDelta(20, 0, 800))
		);
		expect(edgeScrollDelta(5, 0, 100)).toBe(0); // intervallo troppo piccolo
	});

	it('ghostOrigin: sopra il dito per touch, centrato per il mouse', () => {
		const size = { width: 84, height: 124 };
		expect(ghostOrigin({ x: 200, y: 400 }, size, 'touch')).toEqual({ x: 158, y: 250 });
		expect(ghostOrigin({ x: 200, y: 400 }, size, 'mouse')).toEqual({ x: 158, y: 338 });
	});

	it('findZone sceglie il primo bersaglio compatibile sotto il puntatore', () => {
		const slot = {} as Element;
		const shelf = {} as Element;
		const other = {} as Element;
		const registry = new Map<Element, { accepts?: (p: never) => boolean; data?: unknown }>([
			[slot, { accepts: (p: never) => (p as string) === 'queue-item' }],
			[shelf, {}]
		]);
		expect(findZone([other, slot, shelf], 'queue-item', registry)?.node).toBe(slot);
		expect(findZone([other, slot, shelf], 'book', registry)?.node).toBe(shelf);
		expect(findZone([other], 'book', registry)).toBeNull();
	});
});
