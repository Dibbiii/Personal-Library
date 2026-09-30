import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FailedRecord, OutboxRecord, OutboxStorage } from './types';

export const DB_NAME = 'segnalibro-offline';
export const DB_VERSION = 1;

/**
 * Schema IndexedDB condiviso con static/sw-outbox.js (Background Sync): se cambia,
 * aggiornare anche lo script del service worker.
 */
interface OutboxDB extends DBSchema {
	outbox: {
		key: string;
		value: OutboxRecord;
		indexes: { 'by-user': string };
	};
	failed: {
		key: string;
		value: FailedRecord;
		indexes: { 'by-user': string };
	};
	meta: {
		key: string;
		value: { key: string; value: unknown };
	};
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | undefined;

export function openOutboxDb(): Promise<IDBPDatabase<OutboxDB>> {
	dbPromise ??= openDB<OutboxDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			const outbox = db.createObjectStore('outbox', { keyPath: 'eventId' });
			outbox.createIndex('by-user', 'userId');
			const failed = db.createObjectStore('failed', { keyPath: 'eventId' });
			failed.createIndex('by-user', 'userId');
			db.createObjectStore('meta', { keyPath: 'key' });
		},
		terminated() {
			dbPromise = undefined;
		}
	}).catch((error: unknown) => {
		dbPromise = undefined;
		throw error;
	});
	return dbPromise;
}

export class IdbOutboxStorage implements OutboxStorage {
	async add(record: OutboxRecord): Promise<void> {
		const db = await openOutboxDb();
		const tx = db.transaction('outbox', 'readwrite');
		// Un eventId già presente non viene sovrascritto (enqueue idempotente).
		if ((await tx.store.get(record.eventId)) === undefined) await tx.store.add(record);
		await tx.done;
	}

	async get(eventId: string) {
		return (await openOutboxDb()).get('outbox', eventId);
	}

	async listPending(userId: string) {
		return (await openOutboxDb()).getAllFromIndex('outbox', 'by-user', userId);
	}

	async update(record: OutboxRecord) {
		await (await openOutboxDb()).put('outbox', record);
	}

	async remove(eventId: string) {
		await (await openOutboxDb()).delete('outbox', eventId);
	}

	async moveToFailed(record: FailedRecord) {
		const db = await openOutboxDb();
		const tx = db.transaction(['outbox', 'failed'], 'readwrite');
		await tx.objectStore('failed').put(record);
		await tx.objectStore('outbox').delete(record.eventId);
		await tx.done;
	}

	async listFailed(userId: string) {
		return (await openOutboxDb()).getAllFromIndex('failed', 'by-user', userId);
	}

	async requeueFailed(eventId: string) {
		const db = await openOutboxDb();
		const tx = db.transaction(['outbox', 'failed'], 'readwrite');
		const failed = await tx.objectStore('failed').get(eventId);
		if (!failed) {
			await tx.done;
			return false;
		}
		const { reason: _reason, status: _status, failedAt: _failedAt, ...record } = failed;
		await tx
			.objectStore('outbox')
			.put({ ...record, attempts: 0, nextAttemptAt: 0, lastError: null });
		await tx.objectStore('failed').delete(eventId);
		await tx.done;
		return true;
	}

	async removeFailed(eventId: string) {
		await (await openOutboxDb()).delete('failed', eventId);
	}
}

// ---- Meta: utente corrente, letto anche dal service worker (Background Sync) ----

export async function setMeta(key: string, value: unknown): Promise<void> {
	await (await openOutboxDb()).put('meta', { key, value });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
	const row = await (await openOutboxDb()).get('meta', key);
	return row?.value as T | undefined;
}

export async function deleteMeta(key: string): Promise<void> {
	await (await openOutboxDb()).delete('meta', key);
}
