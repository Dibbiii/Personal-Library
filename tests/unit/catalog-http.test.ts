import { describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../../src/lib/server/catalog/http';
import { ProviderGate } from '../../src/lib/server/catalog/provider-gate';

describe('provider pacing and redirects', () => {
	it('spaces requests, bounds queue, honors seconds and HTTP-date Retry-After', () => {
		let now = 100_000;
		const gate = new ProviderGate(1000, () => now);
		expect(gate.reserve()).toBe(0);
		expect(gate.reserve()).toBe(1000);
		gate.pause('2');
		expect(() => gate.check()).toThrow();
		expect(() => gate.reserve()).toThrow();
		now += 2000;
		expect(gate.reserve()).toBe(0);
		gate.pause(new Date(now + 10_000).toUTCString());
		now += 9000;
		expect(() => gate.reserve()).toThrow();
		now += 1000;
		expect(gate.reserve()).toBe(0);
		for (let i = 0; i < 5; i++) gate.reserve();
		expect(() => gate.reserve()).toThrow();
	});
	it('rejects forbidden redirect before fetching target; permits valid edition redirect', async () => {
		const fetch = vi.fn(
			async () =>
				new Response(null, { status: 302, headers: { location: 'https://evil.example/book' } })
		);
		await expect(
			fetchJson('https://openlibrary.org/isbn/9780441013593.json', {
				fetch,
				allowedHosts: ['openlibrary.org']
			})
		).rejects.toMatchObject({ code: 'VALIDATION' });
		expect(fetch).toHaveBeenCalledTimes(1);
		const valid = vi.fn(async (url: string) =>
			url.includes('/isbn/')
				? new Response(null, { status: 302, headers: { location: '/books/OL1M.json' } })
				: new Response('{"title":"Dune"}')
		);
		expect(
			await fetchJson('https://openlibrary.org/isbn/9780441013593.json', {
				fetch: valid,
				allowedHosts: ['openlibrary.org']
			})
		).toEqual({ title: 'Dune' });
		expect(valid).toHaveBeenCalledTimes(2);
	});
});
