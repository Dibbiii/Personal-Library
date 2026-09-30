import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { InProcessLock, OutboxEngine, WebLocksLock } from './core';
import { deleteMeta, IdbOutboxStorage, setMeta } from './idb-storage';
import { outboxStatus } from './status.svelte';
import { sendReadingOp } from './transport';
import {
	readingOpSchema,
	type FlushResult,
	type OutboxLock,
	type ReadingOp,
	type ReadingOperation
} from './types';

export type { ReadingOp, ReadingOperation };
export { outboxStatus };

export const SYNCED_EVENT = 'segnalibro:synced';
export const OUTBOX_SYNC_TAG = 'segnalibro-outbox';
const CHANNEL_NAME = 'segnalibro-outbox';
const META_USER = 'userId';
const SYNCED_BADGE_MS = 3_500;
const FOREGROUND_REFRESH_AFTER_MS = 30_000;

export type SubmitResult = { status: 'synced'; result: unknown } | { status: 'queued' };

export interface SyncedEventDetail {
	eventIds: string[];
	source: 'submit' | 'online' | 'foreground' | 'startup' | 'retry' | 'manual' | 'service-worker';
}

/** Il server ha rifiutato l'aggiornamento in modo permanente (validazione/conflitto): non è stato accodato. */
export class OutboxRejectedError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
	) {
		super(message);
		this.name = 'OutboxRejectedError';
	}
}

/** Genera l'idempotency key dell'evento (UUID v4). */
export function newEventId(): string {
	const c = globalThis.crypto;
	if (typeof c?.randomUUID === 'function') return c.randomUUID();

	const bytes = c.getRandomValues(new Uint8Array(16));
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
	return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

// ---------------------------------------------------------------------------
// Singleton del browser
// ---------------------------------------------------------------------------

const storage = new IdbOutboxStorage();
let engine: OutboxEngine | undefined;
let currentUserId: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let badgeTimer: ReturnType<typeof setTimeout> | undefined;
let channel: BroadcastChannel | undefined;

function createLock(): OutboxLock {
	return typeof navigator !== 'undefined' && navigator.locks
		? new WebLocksLock(navigator.locks)
		: new InProcessLock();
}

function getEngine(): OutboxEngine {
	engine ??= new OutboxEngine({
		storage,
		send: (record) => sendReadingOp(record),
		lock: createLock()
	});
	return engine;
}

function resolveUserId(): string {
	const id = currentUserId ?? page.data.user?.id ?? null;
	if (!id) throw new Error('Outbox: nessun utente autenticato.');
	return id;
}

function isOffline(): boolean {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function refreshOutboxStatus(): Promise<void> {
	const userId = currentUserId ?? page.data.user?.id ?? null;
	if (!userId) return;

	try {
		const [pending, failed] = await Promise.all([
			storage.listPending(userId),
			storage.listFailed(userId)
		]);
		outboxStatus.pending = pending.length;
		outboxStatus.failed = failed.length;
		outboxStatus.pendingItems = pending;
		outboxStatus.failedItems = failed;
	} catch {
		// IndexedDB non disponibile: la coda resta vuota.
	}
}

function broadcastChange(): void {
	try {
		channel?.postMessage('changed');
	} catch {
		// canale chiuso
	}
}

function scheduleRetry(at: number | null): void {
	clearTimeout(retryTimer);
	outboxStatus.nextRetryAt = at;
	if (at === null) return;
	retryTimer = setTimeout(() => void syncOutbox('online'), Math.max(500, at - Date.now()));
}

function markSynced(): void {
	outboxStatus.lastSyncedAt = Date.now();
	outboxStatus.justSynced = true;
	clearTimeout(badgeTimer);
	badgeTimer = setTimeout(() => (outboxStatus.justSynced = false), SYNCED_BADGE_MS);
}

async function afterFlush(result: FlushResult, source: SyncedEventDetail['source']): Promise<void> {
	if (result.skipped) return;

	outboxStatus.authRequired = result.authRequired;
	if (result.offline) outboxStatus.online = false;
	await refreshOutboxStatus();
	scheduleRetry(result.nextRetryAt);

	if (result.delivered.size > 0 || result.rejected.size > 0) broadcastChange();

	if (result.delivered.size > 0) {
		markSynced();
		const detail: SyncedEventDetail = { eventIds: [...result.delivered.keys()], source };
		window.dispatchEvent(new CustomEvent<SyncedEventDetail>(SYNCED_EVENT, { detail }));
		// I dati della pagina corrente sono invecchiati: il database resta la source of truth.
		// Con submit il chiamante aggiorna la propria UI con la risposta del server.
		if (source !== 'submit') await invalidateAll();
	}
}

/**
 * Invia la coda. Sicuro da chiamare in qualsiasi momento: se un altro flush è in corso
 * (anche in un'altra tab) non fa nulla.
 */
export async function syncOutbox(source: SyncedEventDetail['source'] = 'manual'): Promise<void> {
	if (!currentUserId) return;
	if (isOffline()) {
		outboxStatus.online = false;
		return;
	}

	outboxStatus.syncing = true;
	try {
		const result = await getEngine().flush(currentUserId);
		if (!result.skipped && !result.offline) outboxStatus.online = true;
		await afterFlush(result, source);
	} catch {
		// errore di storage: riproveremo al prossimo trigger
	} finally {
		outboxStatus.syncing = false;
	}
}

async function registerBackgroundSync(): Promise<void> {
	try {
		if (!('serviceWorker' in navigator)) return;
		const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
			sync?: { register(tag: string): Promise<void> };
		};
		await registration.sync?.register(OUTBOX_SYNC_TAG);
	} catch {
		// Background Sync non disponibile: bastano gli eventi online/foreground
	}
}

/**
 * API per i dettagli libro (B2). Persiste l'evento, prova a inviarlo subito e:
 * - `{ status: 'synced', result }` se il server l'ha confermato (2xx, `result` = corpo JSON);
 * - `{ status: 'queued' }` se offline / errore di rete / 5xx: resta in IndexedDB e partirà da solo;
 * - lancia `OutboxRejectedError` se il server lo rifiuta in modo permanente (4xx): in tal caso
 *   l'evento NON resta in coda.
 * L'invio avviene sempre dopo gli eventi già in coda (ordine per occurredAt, poi inserimento).
 */
export async function submitReadingOp(op: ReadingOp): Promise<SubmitResult> {
	const valid: ReadingOp = readingOpSchema.parse(op);
	const userId = resolveUserId();
	currentUserId ??= userId;
	const eng = getEngine();

	await eng.enqueue(userId, valid);

	let result: FlushResult | undefined;
	if (!isOffline()) {
		outboxStatus.syncing = true;
		try {
			result = await eng.flush(userId, { wait: true });
		} finally {
			outboxStatus.syncing = false;
		}
		if (!result.offline) outboxStatus.online = true;
		await afterFlush(result, 'submit');
	} else {
		outboxStatus.online = false;
		await refreshOutboxStatus();
		broadcastChange();
	}

	if (result?.delivered.has(valid.eventId)) {
		return { status: 'synced', result: result.delivered.get(valid.eventId) };
	}

	const rejected = result?.rejected.get(valid.eventId);
	if (rejected) {
		// L'errore viene mostrato subito dal chiamante: non va ripresentato fra i "falliti".
		await storage.removeFailed(valid.eventId);
		await refreshOutboxStatus();
		throw new OutboxRejectedError(rejected.reason, rejected.status, rejected.code);
	}

	void registerBackgroundSync();
	return { status: 'queued' };
}

/** Riporta un elemento fallito in coda e riprova subito. */
export async function retryFailed(eventId: string): Promise<void> {
	await storage.requeueFailed(eventId);
	await refreshOutboxStatus();
	await syncOutbox('retry');
}

export async function retryAllFailed(): Promise<void> {
	for (const item of outboxStatus.failedItems) await storage.requeueFailed(item.eventId);
	await refreshOutboxStatus();
	await syncOutbox('retry');
}

export async function discardFailed(eventId: string): Promise<void> {
	await storage.removeFailed(eventId);
	await refreshOutboxStatus();
	broadcastChange();
}

/** "Riprova ora": azzera il backoff degli elementi in attesa e sincronizza. */
export async function syncNow(): Promise<void> {
	for (const item of outboxStatus.pendingItems) {
		if (item.nextAttemptAt > 0) await storage.update({ ...item, nextAttemptAt: 0 });
	}
	await syncOutbox('manual');
}

/** Da chiamare al logout: il service worker non deve più inviare per questo utente. */
export async function forgetOutboxUser(): Promise<void> {
	currentUserId = null;
	try {
		await deleteMeta(META_USER);
	} catch {
		// niente IndexedDB
	}
}

/**
 * Avvia la sync per l'utente corrente: online, ritorno in foreground, avvio app, messaggi del
 * service worker (Background Sync) e altre tab. Restituisce la funzione di stop.
 */
export function startOutbox(userId: string): () => void {
	currentUserId = userId;
	outboxStatus.online = !isOffline();
	void setMeta(META_USER, userId).catch(() => {});

	const onOnline = () => {
		outboxStatus.online = true;
		void syncOutbox('online');
	};
	const onOffline = () => {
		outboxStatus.online = false;
	};

	let hiddenAt: number | null = null;
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') {
			hiddenAt = Date.now();
			return;
		}
		const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
		hiddenAt = null;
		void refreshOutboxStatus();
		void syncOutbox('foreground');
		// Spec §42: al ritorno in foreground i dati rilevanti si rinfrescano (senza realtime).
		if (away >= FOREGROUND_REFRESH_AFTER_MS && !isOffline()) void invalidateAll();
	};

	const onMessage = (event: MessageEvent) => {
		if ((event.data as { type?: string } | null)?.type === 'segnalibro:flush') {
			void syncOutbox('service-worker');
		}
	};

	window.addEventListener('online', onOnline);
	window.addEventListener('offline', onOffline);
	document.addEventListener('visibilitychange', onVisibility);
	navigator.serviceWorker?.addEventListener('message', onMessage);

	if (typeof BroadcastChannel !== 'undefined') {
		channel = new BroadcastChannel(CHANNEL_NAME);
		channel.onmessage = (event: MessageEvent) => {
			const data = event.data as { type?: string; eventIds?: string[] } | string | null;
			void refreshOutboxStatus();
			// Il service worker ha sincronizzato in background (Background Sync).
			if (typeof data === 'object' && data?.type === 'synced') {
				markSynced();
				const detail: SyncedEventDetail = {
					eventIds: data.eventIds ?? [],
					source: 'service-worker'
				};
				window.dispatchEvent(new CustomEvent<SyncedEventDetail>(SYNCED_EVENT, { detail }));
				void invalidateAll();
			}
		};
	}

	void refreshOutboxStatus().then(() => syncOutbox('startup'));

	return () => {
		window.removeEventListener('online', onOnline);
		window.removeEventListener('offline', onOffline);
		document.removeEventListener('visibilitychange', onVisibility);
		navigator.serviceWorker?.removeEventListener('message', onMessage);
		channel?.close();
		channel = undefined;
		clearTimeout(retryTimer);
		clearTimeout(badgeTimer);
	};
}
