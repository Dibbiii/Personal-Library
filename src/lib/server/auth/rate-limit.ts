/**
 * Minimal in-memory rate limiter for login attempts.
 *
 * Scope: one Node process (adapter-node). It is a brake against online password
 * guessing, not a distributed quota: behind several instances the effective
 * limit is multiplied by the instance count. State is lost on restart.
 *
 * Usage in a login action:
 *   const gate = checkLoginRateLimit(email, ip);
 *   if (!gate.allowed) return fail(429, { retryAfterSeconds: gate.retryAfterSeconds });
 *   const user = await authenticate(email, password);
 *   if (!user) recordLoginFailure(email, ip); else clearLoginFailures(email, ip);
 */

export interface RateLimitOptions {
	/** Failures tolerated inside the window before blocking. */
	maxFailures: number;
	windowMs: number;
	/** How long a key stays blocked once it hit maxFailures. */
	blockMs: number;
	/** Injectable clock for tests. */
	now?: () => number;
}

export interface RateLimitDecision {
	allowed: boolean;
	/** Seconds until a blocked key may retry (0 when allowed). */
	retryAfterSeconds: number;
	remaining: number;
}

interface Entry {
	failures: number[];
	blockedUntil: number;
}

export class FailureRateLimiter {
	readonly #options: Required<RateLimitOptions>;
	readonly #entries = new Map<string, Entry>();
	#lastSweep = 0;

	constructor(options: RateLimitOptions) {
		this.#options = { now: Date.now, ...options };
	}

	check(key: string): RateLimitDecision {
		const now = this.#options.now();
		this.#sweep(now);
		const entry = this.#entries.get(key);
		if (!entry)
			return { allowed: true, retryAfterSeconds: 0, remaining: this.#options.maxFailures };

		if (entry.blockedUntil > now) {
			return {
				allowed: false,
				retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
				remaining: 0
			};
		}

		const recent = entry.failures.filter((t) => t > now - this.#options.windowMs);
		return {
			allowed: true,
			retryAfterSeconds: 0,
			remaining: Math.max(0, this.#options.maxFailures - recent.length)
		};
	}

	recordFailure(key: string): RateLimitDecision {
		const now = this.#options.now();
		const entry = this.#entries.get(key) ?? { failures: [], blockedUntil: 0 };
		entry.failures = entry.failures.filter((t) => t > now - this.#options.windowMs);
		entry.failures.push(now);
		if (entry.failures.length >= this.#options.maxFailures) {
			entry.blockedUntil = now + this.#options.blockMs;
			entry.failures = [];
		}
		this.#entries.set(key, entry);
		return this.check(key);
	}

	reset(key: string): void {
		this.#entries.delete(key);
	}

	clear(): void {
		this.#entries.clear();
	}

	get size(): number {
		return this.#entries.size;
	}

	/** Drops expired entries at most once a minute so the map cannot grow unbounded. */
	#sweep(now: number): void {
		if (now - this.#lastSweep < 60_000) return;
		this.#lastSweep = now;
		for (const [key, entry] of this.#entries) {
			const live =
				entry.blockedUntil > now || entry.failures.some((t) => t > now - this.#options.windowMs);
			if (!live) this.#entries.delete(key);
		}
	}
}

const WINDOW_MS = 15 * 60_000;

// Per email + IP: 5 failures / 15 min, then blocked for 15 min.
const perAccount = new FailureRateLimiter({
	maxFailures: 5,
	windowMs: WINDOW_MS,
	blockMs: WINDOW_MS
});
// Per IP alone (credential stuffing across many emails): 30 failures / 15 min.
const perIp = new FailureRateLimiter({ maxFailures: 30, windowMs: WINDOW_MS, blockMs: WINDOW_MS });

function accountKey(email: string, ip: string): string {
	return `${email.trim().toLowerCase()}|${ip}`;
}

export function checkLoginRateLimit(email: string, ip: string): RateLimitDecision {
	const account = perAccount.check(accountKey(email, ip));
	const address = perIp.check(ip);
	if (!account.allowed || !address.allowed) {
		return {
			allowed: false,
			retryAfterSeconds: Math.max(account.retryAfterSeconds, address.retryAfterSeconds),
			remaining: 0
		};
	}
	return {
		allowed: true,
		retryAfterSeconds: 0,
		remaining: Math.min(account.remaining, address.remaining)
	};
}

export function recordLoginFailure(email: string, ip: string): RateLimitDecision {
	const account = perAccount.recordFailure(accountKey(email, ip));
	perIp.recordFailure(ip);
	return account;
}

/** Call after a successful login (clears the per-account counter only). */
export function clearLoginFailures(email: string, ip: string): void {
	perAccount.reset(accountKey(email, ip));
}

/** Test helper. */
export function resetLoginRateLimits(): void {
	perAccount.clear();
	perIp.clear();
}
