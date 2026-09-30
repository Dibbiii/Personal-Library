import type {
	FailedRecord,
	FlushResult,
	OutboxLock,
	OutboxRecord,
	OutboxStorage,
	ReadingOp,
	Send
} from './types';

export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Backoff esponenziale con jitter limitato (±20%). `random` è iniettabile per i test. */
export function backoffDelay(attempts: number, random: () => number = Math.random): number {
	const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
	const jitter = 1 + (random() * 0.4 - 0.2);
	return Math.min(BACKOFF_MAX_MS, Math.round(exp * jitter));
}

/** Ordine stabile: occurredAt, poi ordine di inserimento. */
export function compareRecords(a: OutboxRecord, b: OutboxRecord): number {
	const ta = Date.parse(a.occurredAt);
	const tb = Date.parse(b.occurredAt);
	if (ta !== tb) return ta - tb;
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
	if (a.seq !== b.seq) return a.seq - b.seq;
	return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
}

export interface OutboxEngineOptions {
	storage: OutboxStorage;
	send: Send;
	lock: OutboxLock;
	now?: () => number;
	random?: () => number;
}

const LOCK_NAME = 'segnalibro-outbox-flush';

/**
 * Logica della outbox senza I/O diretto (storage, rete e lock sono iniettati).
 *
 * Invarianti:
 * - una voce esce dalla coda solo dopo un ack 2xx del server (idempotente per eventId);
 * - gli eventi di una stessa lettura vengono inviati in ordine: se uno è in backoff o in
 *   errore transitorio, i successivi della stessa lettura aspettano;
 * - un errore di rete ferma il flush (siamo offline), un 4xx permanente sposta la voce in `failed`.
 */
export class OutboxEngine {
	readonly #storage: OutboxStorage;
	readonly #send: Send;
	readonly #lock: OutboxLock;
	readonly #now: () => number;
	readonly #random: () => number;
	#seq = 0;

	constructor(options: OutboxEngineOptions) {
		this.#storage = options.storage;
		this.#send = options.send;
		this.#lock = options.lock;
		this.#now = options.now ?? Date.now;
		this.#random = options.random ?? Math.random;
	}

	async enqueue(userId: string, op: ReadingOp): Promise<OutboxRecord> {
		const existing = await this.#storage.get(op.eventId);
		if (existing) return existing;

		const record: OutboxRecord = {
			...op,
			userId,
			createdAt: this.#now(),
			seq: this.#seq++,
			attempts: 0,
			nextAttemptAt: 0,
			lastError: null
		};
		await this.#storage.add(record);
		return record;
	}

	/**
	 * Invia la coda dell'utente. `wait: true` attende il lock di un altro flush (usato da
	 * submit, che vuole sapere l'esito); `wait: false` esce subito con `skipped`.
	 */
	async flush(userId: string, options: { wait?: boolean } = {}): Promise<FlushResult> {
		const result = await this.#lock.run(LOCK_NAME, { wait: options.wait ?? false }, () =>
			this.#flushLocked(userId)
		);
		return result ?? emptyResult({ skipped: true });
	}

	async #flushLocked(userId: string): Promise<FlushResult> {
		const result = emptyResult();
		const pending = (await this.#storage.listPending(userId)).sort(compareRecords);
		const blockedReadings = new Set<string>();

		for (const item of pending) {
			if (blockedReadings.has(item.readingId)) continue;

			if (item.nextAttemptAt > this.#now()) {
				blockedReadings.add(item.readingId);
				result.nextRetryAt = earliest(result.nextRetryAt, item.nextAttemptAt);
				continue;
			}

			const outcome = await this.#send(item);

			if (outcome.kind === 'ok') {
				await this.#storage.remove(item.eventId);
				result.delivered.set(item.eventId, outcome.body);
				continue;
			}

			if (outcome.kind === 'rejected') {
				const failed: FailedRecord = {
					...item,
					attempts: item.attempts + 1,
					lastError: outcome.reason,
					reason: outcome.reason,
					status: outcome.status,
					failedAt: this.#now()
				};
				await this.#storage.moveToFailed(failed);
				const info: { reason: string; status: number; code?: string } = {
					reason: outcome.reason,
					status: outcome.status
				};
				if (outcome.code) info.code = outcome.code;
				result.rejected.set(item.eventId, info);
				continue;
			}

			if (outcome.kind === 'network') {
				result.offline = true;
				break;
			}

			if (outcome.kind === 'auth') {
				result.authRequired = true;
				break;
			}

			// retry: 5xx / 408 / 429
			const attempts = item.attempts + 1;
			const nextAttemptAt = this.#now() + backoffDelay(attempts, this.#random);
			await this.#storage.update({
				...item,
				attempts,
				nextAttemptAt,
				lastError: `HTTP ${outcome.status}`
			});
			blockedReadings.add(item.readingId);
			result.nextRetryAt = earliest(result.nextRetryAt, nextAttemptAt);
		}

		return result;
	}
}

function earliest(current: number | null, candidate: number): number {
	return current === null ? candidate : Math.min(current, candidate);
}

function emptyResult(overrides: Partial<FlushResult> = {}): FlushResult {
	return {
		delivered: new Map(),
		rejected: new Map(),
		skipped: false,
		offline: false,
		authRequired: false,
		nextRetryAt: null,
		...overrides
	};
}

/** Lock solo in-process: serializza i flush della stessa pagina (fallback senza Web Locks). */
export class InProcessLock implements OutboxLock {
	#tail: Promise<unknown> = Promise.resolve();
	/** Esecuzioni in corso o in attesa del lock. */
	#active = 0;

	async run<T>(
		_name: string,
		options: { wait: boolean },
		fn: () => Promise<T>
	): Promise<T | undefined> {
		if (this.#active > 0 && !options.wait) return undefined;

		this.#active++;
		const previous = this.#tail;
		let release!: () => void;
		this.#tail = new Promise<void>((resolve) => (release = resolve));

		await previous;
		try {
			return await fn();
		} finally {
			this.#active--;
			release();
		}
	}
}

/** Web Locks API: un solo flush alla volta fra tutte le tab dell'origine. */
export class WebLocksLock implements OutboxLock {
	constructor(private readonly locks: LockManager) {}

	async run<T>(
		name: string,
		options: { wait: boolean },
		fn: () => Promise<T>
	): Promise<T | undefined> {
		return this.locks.request(
			name,
			{ mode: 'exclusive', ifAvailable: !options.wait },
			async (lock): Promise<T | undefined> => {
				if (!lock) return undefined;
				return fn();
			}
		);
	}
}
