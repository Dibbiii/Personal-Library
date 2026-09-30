import { z } from 'zod';

export const READING_OPERATIONS = ['progress', 'correction', 'finish', 'dnf'] as const;
export type ReadingOperation = (typeof READING_OPERATIONS)[number];

/** Evento di lettura generato dal client (MASTER_SPEC §8-9). `eventId` è la idempotency key. */
export type ReadingOp = {
	eventId: string;
	readingId: string;
	page: number;
	occurredAt: string;
	localDate: string;
	operation: ReadingOperation;
};

export const readingOpSchema = z.object({
	eventId: z.string().uuid(),
	readingId: z.string().uuid(),
	page: z.number().int().nonnegative(),
	occurredAt: z.string().datetime({ offset: true }),
	localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	operation: z.enum(READING_OPERATIONS)
});

/** Voce in coda: l'evento più i metadati di sincronizzazione. */
export type OutboxRecord = ReadingOp & {
	/** Utente proprietario: la sync non invia mai eventi di un altro account. */
	userId: string;
	/** Ordine di inserimento (tie-break dopo occurredAt). */
	createdAt: number;
	seq: number;
	attempts: number;
	/** Epoch ms prima del quale non ritentare (backoff dei 5xx). 0 = subito. */
	nextAttemptAt: number;
	lastError: string | null;
};

/** Voce scartata dal server con un errore permanente (4xx di validazione/conflitto). */
export type FailedRecord = OutboxRecord & {
	reason: string;
	status: number | null;
	failedAt: number;
};

/** Persistenza della outbox. Implementata con IndexedDB (idb-storage.ts) e in memoria nei test. */
export interface OutboxStorage {
	/** Inserisce la voce se l'eventId non è già in coda (idempotente). */
	add(record: OutboxRecord): Promise<void>;
	get(eventId: string): Promise<OutboxRecord | undefined>;
	listPending(userId: string): Promise<OutboxRecord[]>;
	update(record: OutboxRecord): Promise<void>;
	remove(eventId: string): Promise<void>;
	moveToFailed(record: FailedRecord): Promise<void>;
	listFailed(userId: string): Promise<FailedRecord[]>;
	/** Riporta una voce fallita in coda (Riprova). Restituisce false se non esiste. */
	requeueFailed(eventId: string): Promise<boolean>;
	removeFailed(eventId: string): Promise<void>;
}

/** Esito di un tentativo di invio, già classificato (vedi transport.ts). */
export type SendOutcome =
	| { kind: 'ok'; body: unknown }
	/** Nessuna risposta del server (offline, timeout, DNS). */
	| { kind: 'network' }
	/** 5xx, 408, 429: riprovare con backoff. */
	| { kind: 'retry'; status: number }
	/** Sessione scaduta (401/403/redirect al login): la voce resta in coda. */
	| { kind: 'auth' }
	/** Altro 4xx: errore permanente, la voce passa a `failed`. */
	| { kind: 'rejected'; status: number; reason: string; code?: string };

export type Send = (record: OutboxRecord) => Promise<SendOutcome>;

/** Mutua esclusione tra tab. `wait: false` salta se un altro detiene già il lock. */
export interface OutboxLock {
	run<T>(name: string, options: { wait: boolean }, fn: () => Promise<T>): Promise<T | undefined>;
}

export type FlushResult = {
	/** eventId -> corpo della risposta del server. */
	delivered: Map<string, unknown>;
	/** eventId -> motivo, per le voci passate a `failed` in questo flush. */
	rejected: Map<string, { reason: string; status: number; code?: string }>;
	/** Il flush non è partito perché un altro lo stava già eseguendo. */
	skipped: boolean;
	/** Interrotto da un errore di rete. */
	offline: boolean;
	/** Interrotto perché la sessione non è valida. */
	authRequired: boolean;
	/** Prossimo tentativo programmato (epoch ms) per voci in backoff. */
	nextRetryAt: number | null;
};
