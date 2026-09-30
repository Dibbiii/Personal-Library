import { describe, expect, it, vi } from 'vitest';
import { CATALOG_TTL, TtlCache } from '../../src/lib/catalog/cache';
import { RateLimiter } from '../../src/lib/server/catalog/rate-limit';

function clock(start = 1_000) {
	let now = start;
	return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('TtlCache', () => {
	it('scade dopo il TTL', () => {
		const time = clock();
		const cache = new TtlCache<string>({ maxEntries: 10, now: time.now });
		cache.set('a', 'uno', 1000);
		expect(cache.get('a')).toBe('uno');
		time.advance(999);
		expect(cache.get('a')).toBe('uno');
		time.advance(2);
		expect(cache.get('a')).toBeUndefined();
		expect(cache.size).toBe(0);
	});

	it('scarta la voce usata meno di recente (LRU)', () => {
		const cache = new TtlCache<number>({ maxEntries: 2 });
		cache.set('a', 1, 10_000);
		cache.set('b', 2, 10_000);
		cache.get('a'); // a è di nuovo recente
		cache.set('c', 3, 10_000);
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('a')).toBe(1);
		expect(cache.get('c')).toBe(3);
	});

	it('getOrLoad cachea e condivide le richieste concorrenti', async () => {
		const cache = new TtlCache<number>({ maxEntries: 5 });
		const load = vi.fn(async () => 42);
		const [x, y] = await Promise.all([
			cache.getOrLoad('k', load, 1000),
			cache.getOrLoad('k', load, 1000)
		]);
		expect([x, y]).toEqual([42, 42]);
		expect(await cache.getOrLoad('k', load, 1000)).toBe(42);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('TTL dinamico: 0 = non cachea; gli errori non vengono cacheati', async () => {
		const cache = new TtlCache<number>({ maxEntries: 5 });
		const load = vi.fn(async () => 1);
		await cache.getOrLoad('k', load, () => 0);
		await cache.getOrLoad('k', load, () => 0);
		expect(load).toHaveBeenCalledTimes(2);

		const failing = vi.fn(async () => {
			throw new Error('giù');
		});
		await expect(cache.getOrLoad('e', failing, 1000)).rejects.toThrow('giù');
		await expect(cache.getOrLoad('e', failing, 1000)).rejects.toThrow('giù');
		expect(failing).toHaveBeenCalledTimes(2);
	});

	it('TTL della specifica: ISBN positivo >> ricerca >> negativo', () => {
		const hour = 3600_000;
		expect(CATALOG_TTL.search).toBeGreaterThanOrEqual(6 * hour);
		expect(CATALOG_TTL.search).toBeLessThanOrEqual(24 * hour);
		expect(CATALOG_TTL.isbnHit).toBeGreaterThan(CATALOG_TTL.search * 10);
		expect(CATALOG_TTL.isbnMiss).toBeLessThan(CATALOG_TTL.search);
	});
});

describe('RateLimiter', () => {
	it('blocca oltre il massimo nella finestra e riapre dopo', () => {
		const time = clock();
		const limiter = new RateLimiter({ windowMs: 60_000, max: 2, now: time.now });
		expect(limiter.consume('u1').allowed).toBe(true);
		expect(limiter.consume('u1').allowed).toBe(true);
		const blocked = limiter.consume('u1');
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSeconds).toBe(60);
		expect(limiter.consume('u2').allowed).toBe(true); // per utente
		time.advance(60_001);
		expect(limiter.consume('u1').allowed).toBe(true);
	});
});
