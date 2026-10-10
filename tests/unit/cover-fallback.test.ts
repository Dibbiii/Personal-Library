import { describe, expect, it } from 'vitest';
import { IsbnCoverFallback } from '../../src/lib/catalog/cover-fallback';

function isbn(n: number) {
	const body = `97910${String(n).padStart(7, '0')}`;
	const sum = [...body].reduce(
		(total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
		0
	);
	return `${body}${(10 - (sum % 10)) % 10}`;
}

describe('ISBN cover fallback', () => {
	it('normalizes ISBN-10 to the same exact ISBN-13 and rejects invalid input', () => {
		const fallback = new IsbnCoverFallback();
		expect(fallback.acquire('0385472579')).toBe(fallback.acquire('9780385472579'));
		expect(fallback.acquire('9780385472579')).toContain('/isbn/9780385472579-L.jpg?default=false');
		expect(fallback.acquire('invalid')).toBeNull();
		expect(fallback.acquire(null)).toBeNull();
	});
	it('caches missing images briefly and permits a later retry', () => {
		let now = 0;
		const fallback = new IsbnCoverFallback(() => now);
		const url = fallback.acquire(isbn(1))!;
		fallback.settle(url, false);
		expect(fallback.acquire(isbn(1))).toBeNull();
		now = 60_001;
		expect(fallback.acquire(isbn(1))).toBe(url);
	});
	it('limits new requests while allowing shared pending and successful images', () => {
		let now = 0;
		const fallback = new IsbnCoverFallback(() => now);
		const first = fallback.acquire(isbn(0))!;
		for (let n = 1; n < 80; n++) expect(fallback.acquire(isbn(n))).not.toBeNull();
		expect(fallback.acquire(isbn(0))).toBe(first);
		fallback.settle(first, true);
		expect(fallback.acquire(isbn(80))).toBeNull();
		now = 300_001;
		expect(fallback.acquire(isbn(0))).toBe(first);
		expect(fallback.acquire(isbn(80))).not.toBeNull();
	});
});
