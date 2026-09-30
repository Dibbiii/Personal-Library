/**
 * Cache in memoria di processo con TTL per voce e scarto LRU (niente Redis: spec sez. 43).
 * Con più istanze ogni processo ha la sua cache, il che è innocuo per dati di sola lettura.
 */
export interface TtlCacheOptions {
	maxEntries: number;
	/** Orologio iniettabile per i test */
	now?: () => number;
}

interface Entry<V> {
	value: V;
	expiresAt: number;
}

export class TtlCache<V> {
	private readonly entries = new Map<string, Entry<V>>();
	private readonly inflight = new Map<string, Promise<V>>();
	private readonly maxEntries: number;
	private readonly now: () => number;

	constructor(options: TtlCacheOptions) {
		this.maxEntries = Math.max(1, options.maxEntries);
		this.now = options.now ?? Date.now;
	}

	get size(): number {
		return this.entries.size;
	}

	get(key: string): V | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= this.now()) {
			this.entries.delete(key);
			return undefined;
		}
		// LRU: rimette la voce in coda
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.value;
	}

	set(key: string, value: V, ttlMs: number): void {
		this.entries.delete(key);
		this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
	}

	delete(key: string): void {
		this.entries.delete(key);
	}

	clear(): void {
		this.entries.clear();
		this.inflight.clear();
	}

	/**
	 * Restituisce il valore in cache o lo calcola. Richieste concorrenti con la stessa chiave
	 * condividono un'unica chiamata. `ttl` riceve il valore e decide la durata (0 = non cacheare).
	 */
	async getOrLoad(
		key: string,
		load: () => Promise<V>,
		ttl: number | ((value: V) => number)
	): Promise<V> {
		const cached = this.get(key);
		if (cached !== undefined) return cached;

		const pending = this.inflight.get(key);
		if (pending) return pending;

		const promise = (async () => {
			try {
				const value = await load();
				const ttlMs = typeof ttl === 'function' ? ttl(value) : ttl;
				if (ttlMs > 0) this.set(key, value, ttlMs);
				return value;
			} finally {
				this.inflight.delete(key);
			}
		})();
		this.inflight.set(key, promise);
		return promise;
	}
}

const HOUR = 60 * 60 * 1000;

/** TTL della specifica sez. 43. */
export const CATALOG_TTL = {
	/** ricerca titolo/autore: 6-24h */
	search: 12 * HOUR,
	/** lookup ISBN positivo: molto più lungo */
	isbnHit: 30 * 24 * HOUR,
	/** lookup ISBN senza risultati (il catalogo può aggiornarsi): breve */
	isbnMiss: 15 * 60 * 1000,
	/** risposta parziale (un provider giù): si riprova presto */
	degraded: 60 * 1000
} as const;
