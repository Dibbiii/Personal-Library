import { scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	dummyPasswordHash,
	hashPassword,
	needsRehash,
	verifyPassword
} from '../../src/lib/server/auth/password';
import {
	FailureRateLimiter,
	checkLoginRateLimit,
	clearLoginFailures,
	recordLoginFailure,
	resetLoginRateLimits
} from '../../src/lib/server/auth/rate-limit';
import { classifySqlState } from '../../src/lib/server/db/rpc';

describe('password hashing (scrypt)', () => {
	it('hashes with a random salt and verifies in constant-time form', async () => {
		const a = await hashPassword('correct horse battery');
		const b = await hashPassword('correct horse battery');
		expect(a).not.toBe(b);
		expect(a).toMatch(/^scrypt\$16\$8\$2\$[\w-]+\$[\w-]+$/);
		expect(a).not.toContain('correct horse');

		expect(await verifyPassword('correct horse battery', a)).toBe(true);
		expect(await verifyPassword('correct horse batterx', a)).toBe(false);
		expect(await verifyPassword('', a)).toBe(false);
		expect(needsRehash(a)).toBe(false);
	});

	it('normalises unicode (NFC/NFD spellings of the same password match)', async () => {
		const hash = await hashPassword('caffè-lungo-2026');
		expect(await verifyPassword('caffè-lungo-2026', hash)).toBe(true);
	});

	it('rejects malformed or hostile stored hashes without throwing', async () => {
		for (const stored of [
			'',
			'plaintext',
			'scrypt$16$8$2$abc',
			'bcrypt$16$8$2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
			'scrypt$30$8$2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // N = 2^30
			'scrypt$16$8$200$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
			'scrypt$x$8$2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
			'scrypt$16$8$2$$'
		]) {
			expect(await verifyPassword('anything', stored), stored).toBe(false);
		}
	});

	it('flags weaker parameters for re-hashing and verifies them using the stored parameters', async () => {
		const salt = Buffer.from('0123456789abcdef');
		const key = scryptSync('old password', salt, 64, { N: 2 ** 14, r: 8, p: 1 });
		const old = ['scrypt', 14, 8, 1, salt.toString('base64url'), key.toString('base64url')].join('$');
		expect(await verifyPassword('old password', old)).toBe(true);
		expect(await verifyPassword('new password', old)).toBe(false);
		expect(needsRehash(old)).toBe(true);
		expect(needsRehash('garbage')).toBe(true);
	});

	it('provides a valid dummy hash for timing equalisation', async () => {
		const dummy = await dummyPasswordHash();
		expect(await verifyPassword('whatever', dummy)).toBe(false);
		expect(await dummyPasswordHash()).toBe(dummy);
	});
});

describe('login rate limiting', () => {
	it('blocks after 5 failures for the same email+IP and unblocks after the window', () => {
		let t = 1_000_000;
		const limiter = new FailureRateLimiter({ maxFailures: 5, windowMs: 900_000, blockMs: 900_000, now: () => t });

		for (let i = 0; i < 4; i += 1) {
			expect(limiter.recordFailure('k').allowed).toBe(true);
		}
		expect(limiter.check('k')).toMatchObject({ allowed: true, remaining: 1 });

		const blocked = limiter.recordFailure('k');
		expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
		expect(blocked.retryAfterSeconds).toBe(900);

		t += 600_000;
		expect(limiter.check('k')).toMatchObject({ allowed: false, retryAfterSeconds: 300 });
		expect(limiter.check('other').allowed).toBe(true);

		t += 300_001;
		expect(limiter.check('k').allowed).toBe(true);
	});

	it('failures outside the window do not accumulate; reset clears the counter', () => {
		let t = 0;
		const limiter = new FailureRateLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 5000, now: () => t });
		limiter.recordFailure('k');
		limiter.recordFailure('k');
		t += 1001;
		expect(limiter.recordFailure('k').allowed).toBe(true);
		expect(limiter.check('k').remaining).toBe(2);

		limiter.recordFailure('k');
		limiter.reset('k');
		expect(limiter.check('k').remaining).toBe(3);
	});

	it('sweeps expired entries so memory stays bounded', () => {
		let t = 0;
		const limiter = new FailureRateLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 1000, now: () => t });
		for (let i = 0; i < 100; i += 1) limiter.recordFailure(`k${i}`);
		expect(limiter.size).toBe(100);
		t += 120_000;
		limiter.check('anything');
		expect(limiter.size).toBe(0);
	});

	it('exposes per email+IP helpers (email is case/whitespace insensitive) and a per-IP cap', () => {
		resetLoginRateLimits();
		for (let i = 0; i < 5; i += 1) recordLoginFailure(i % 2 ? ' Foo@Example.test' : 'foo@example.test', '10.0.0.1');
		expect(checkLoginRateLimit('FOO@example.test ', '10.0.0.1').allowed).toBe(false);
		expect(checkLoginRateLimit('foo@example.test', '10.0.0.2').allowed).toBe(true);
		expect(checkLoginRateLimit('bar@example.test', '10.0.0.1').allowed).toBe(true);

		clearLoginFailures('foo@example.test', '10.0.0.1');
		expect(checkLoginRateLimit('foo@example.test', '10.0.0.1').allowed).toBe(true);

		// credential stuffing: many different emails from one address
		resetLoginRateLimits();
		for (let i = 0; i < 30; i += 1) recordLoginFailure(`user${i}@example.test`, '10.9.9.9');
		expect(checkLoginRateLimit('brand-new@example.test', '10.9.9.9').allowed).toBe(false);
		expect(checkLoginRateLimit('brand-new@example.test', '10.9.9.8').allowed).toBe(true);
		resetLoginRateLimits();
	});
});

describe('Postgres error -> error model', () => {
	it.each([
		['42501', 'AUTH_REQUIRED'],
		['P0002', 'NOT_FOUND'],
		['23505', 'CONFLICT'],
		['55000', 'CONFLICT'],
		['40001', 'CONFLICT'],
		['40P01', 'CONFLICT'],
		['P0001', 'VALIDATION'],
		['23503', 'VALIDATION'],
		['23514', 'VALIDATION'],
		['22P02', 'VALIDATION'],
		['22023', 'VALIDATION'],
		['53300', 'RATE_LIMITED'],
		['ECONNREFUSED', 'NETWORK'],
		['CONNECTION_CLOSED', 'NETWORK'],
		['CONNECT_TIMEOUT', 'NETWORK'],
		['08006', 'NETWORK'],
		['57P01', 'NETWORK'],
		['XX000', 'SERVER'],
		['42P01', 'SERVER'],
		[undefined, 'SERVER']
	] as const)('%s -> %s', (sqlState, expected) => {
		expect(classifySqlState(sqlState)).toBe(expected);
	});
});
