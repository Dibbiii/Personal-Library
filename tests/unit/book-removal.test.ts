import { describe, expect, it, vi } from 'vitest';
import {
	BookRemovalGuardError,
	withBookRemovalGuard,
	type BookRemovalDependencies
} from '../../src/lib/offline/book-removal';
import { InProcessLock } from '../../src/lib/offline/core';
import type { FailedRecord, OutboxRecord, OutboxLock } from '../../src/lib/offline/types';

const USER = 'current-user';
const READING = 'book-reading';

function record(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
	return {
		eventId: 'event',
		userId: USER,
		readingId: READING,
		page: 12,
		operation: 'progress',
		occurredAt: '2026-10-06T10:00:00Z',
		localDate: '2026-10-06',
		createdAt: 1,
		seq: 0,
		attempts: 0,
		nextAttemptAt: 0,
		lastError: null,
		...overrides
	};
}

function failedRecord(overrides: Partial<OutboxRecord> = {}): FailedRecord {
	return { ...record(overrides), reason: 'CONFLICT', status: 409, failedAt: 2 };
}

function setup(pending: OutboxRecord[] = [], failed: FailedRecord[] = []) {
	const storage = {
		listPending: vi.fn(async (_userId: string) => pending),
		listFailed: vi.fn(async (_userId: string) => failed)
	};
	const online = vi.fn(() => true);
	const dependencies: BookRemovalDependencies = { storage, online, lock: new InProcessLock() };
	const run = vi.fn(async () => 'removed');
	return { dependencies, storage, online, run };
}

describe('withBookRemovalGuard', () => {
	it('blocca offline prima di controllare la coda o acquisire il lock', async () => {
		const { dependencies, storage, online, run } = setup();
		online.mockReturnValue(false);
		const lock = new InProcessLock();
		const lockRun = vi.spyOn(lock, 'run');
		dependencies.lock = lock;
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
			'devi essere online'
		);
		expect(lockRun).not.toHaveBeenCalled();
		expect(storage.listPending).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});

	it('ricontrolla la rete dopo aver atteso il lock', async () => {
		const { dependencies, storage, online, run } = setup();
		online.mockReturnValueOnce(true).mockReturnValue(false);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
			'devi essere online'
		);
		expect(storage.listPending).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});

	it('ricontrolla la rete dopo la lettura dello storage, prima dell’invio', async () => {
		const { dependencies, online, run } = setup();
		online.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
			'devi essere online'
		);
		expect(run).not.toHaveBeenCalled();
	});

	it('blocca gli eventi pending anche se in backoff', async () => {
		const { dependencies, run } = setup([record({ nextAttemptAt: Number.MAX_SAFE_INTEGER })]);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
			'aggiornamenti di lettura in attesa o falliti'
		);
		expect(run).not.toHaveBeenCalled();
	});

	it('blocca gli eventi failed anche senza pending', async () => {
		const { dependencies, run } = setup([], [failedRecord()]);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
			'aggiornamenti di lettura in attesa o falliti'
		);
		expect(run).not.toHaveBeenCalled();
	});

	it('considera tutte le letture del libro, non solo quella corrente', async () => {
		const { dependencies, run } = setup([record({ readingId: 'old-reading' })]);
		await expect(
			withBookRemovalGuard(USER, [READING, 'old-reading'], run, dependencies)
		).rejects.toBeInstanceOf(BookRemovalGuardError);
		expect(run).not.toHaveBeenCalled();
	});

	it('ignora eventi di un altro utente o di altre letture, pending e failed', async () => {
		const { dependencies, storage, run } = setup(
			[record({ userId: 'other-user' }), record({ readingId: 'other-reading' })],
			[failedRecord({ userId: 'other-user' }), failedRecord({ readingId: 'other-reading' })]
		);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).resolves.toBe('removed');
		expect(storage.listPending).toHaveBeenCalledWith(USER);
		expect(storage.listFailed).toHaveBeenCalledWith(USER);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it.each(['listPending', 'listFailed'] as const)(
		'fallisce chiuso se %s non è disponibile',
		async (method) => {
			const { dependencies, storage, run } = setup();
			storage[method].mockRejectedValue(new Error('IndexedDB unavailable'));
			await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toThrow(
				'Abilita l’archiviazione del browser'
			);
			expect(run).not.toHaveBeenCalled();
		}
	);

	it('controlla lo storage anche per un libro senza letture', async () => {
		const { dependencies, storage, run } = setup();
		storage.listPending.mockRejectedValue(new Error('IndexedDB unavailable'));
		await expect(withBookRemovalGuard(USER, [], run, dependencies)).rejects.toBeInstanceOf(
			BookRemovalGuardError
		);
		expect(run).not.toHaveBeenCalled();
	});

	it('mantiene il lock esclusivo di flush durante controllo e invio', async () => {
		const { dependencies, storage } = setup();
		let locked = false;
		const lock: OutboxLock = {
			async run<T>(name: string, options: { wait: boolean }, fn: () => Promise<T>) {
				expect(name).toBe('segnalibro-outbox-flush');
				expect(options).toEqual({ wait: true });
				locked = true;
				try {
					return await fn();
				} finally {
					locked = false;
				}
			}
		};
		dependencies.lock = lock;
		storage.listPending.mockImplementation(async () => {
			expect(locked).toBe(true);
			return [];
		});
		storage.listFailed.mockImplementation(async () => {
			expect(locked).toBe(true);
			return [];
		});
		const result = { bookId: 'book', readingIds: [READING] };
		await expect(
			withBookRemovalGuard(
				USER,
				[READING],
				async () => {
					expect(locked).toBe(true);
					return result;
				},
				dependencies
			)
		).resolves.toBe(result);
		expect(locked).toBe(false);
	});

	it('attende il flush e rilegge la coda corrente dopo il rilascio', async () => {
		const pending = [record()];
		const { dependencies, run } = setup(pending);
		const lock = new InProcessLock();
		dependencies.lock = lock;
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const flushing = lock.run('segnalibro-outbox-flush', { wait: true }, async () => {
			await gate;
			pending.length = 0;
		});
		const removing = withBookRemovalGuard(USER, [READING], run, dependencies);
		expect(run).not.toHaveBeenCalled();
		release();
		await flushing;
		await expect(removing).resolves.toBe('removed');
	});

	it('propaga gli errori della richiesta senza descriverli come errori IndexedDB', async () => {
		const { dependencies, run } = setup();
		const error = new Error('HTTP conflict');
		run.mockRejectedValue(error);
		await expect(withBookRemovalGuard(USER, [READING], run, dependencies)).rejects.toBe(error);
	});

	it('supporta callback senza valore di ritorno', async () => {
		const { dependencies } = setup();
		await expect(
			withBookRemovalGuard(USER, [], async () => {}, dependencies)
		).resolves.toBeUndefined();
	});
});
