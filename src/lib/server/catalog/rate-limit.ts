/**
 * Rate limit leggero per utente, in memoria di processo (finestra scorrevole).
 * Con più istanze il limite effettivo si moltiplica e si azzera al riavvio: è una protezione
 * contro errori del client e abusi banali, non un controllo di sicurezza forte.
 */
export interface RateLimiterOptions {
	windowMs: number;
	max: number;
	now?: () => number;
}

export interface RateLimitResult {
	allowed: boolean;
	retryAfterSeconds: number;
	remaining: number;
}

export class RateLimiter {
	private readonly hits = new Map<string, number[]>();
	private readonly now: () => number;

	constructor(private readonly options: RateLimiterOptions) {
		this.now = options.now ?? Date.now;
	}

	/** Registra una richiesta se consentita. */
	consume(key: string): RateLimitResult {
		const now = this.now();
		const windowStart = now - this.options.windowMs;
		const recent = (this.hits.get(key) ?? []).filter((time) => time > windowStart);

		if (recent.length >= this.options.max) {
			this.hits.set(key, recent);
			const oldest = recent[0] ?? now;
			return {
				allowed: false,
				retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.options.windowMs - now) / 1000)),
				remaining: 0
			};
		}

		recent.push(now);
		this.hits.set(key, recent);
		if (this.hits.size > 5000) this.prune(windowStart);
		return { allowed: true, retryAfterSeconds: 0, remaining: this.options.max - recent.length };
	}

	private prune(windowStart: number): void {
		for (const [key, times] of this.hits) {
			if (times.every((time) => time <= windowStart)) this.hits.delete(key);
		}
	}
}
