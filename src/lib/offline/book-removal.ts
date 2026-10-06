import { InProcessLock, WebLocksLock } from './core';
import { IdbOutboxStorage } from './idb-storage';
import type { OutboxLock, OutboxStorage } from './types';

// Stesso lock di core.ts e static/sw-outbox.js: resta acquisito fino alla risposta della delete.
const FLUSH_LOCK = 'segnalibro-outbox-flush';
const fallbackLock = new InProcessLock();

export class BookRemovalGuardError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BookRemovalGuardError';
	}
}

export interface BookRemovalDependencies {
	storage: Pick<OutboxStorage, 'listPending' | 'listFailed'>;
	online: () => boolean;
	lock: OutboxLock;
}

function requireOnline(online: () => boolean): void {
	if (!online()) {
		throw new BookRemovalGuardError(
			'Per eliminare un libro devi essere online. Riconnettiti e riprova.'
		);
	}
}

/** Nessuna mutazione locale: controlla anche gli eventi falliti, che possono essere ritentati. */
export async function withBookRemovalGuard<T>(
	userId: string,
	readingIds: readonly string[],
	run: () => Promise<T>,
	dependencies: BookRemovalDependencies = {
		storage: new IdbOutboxStorage(),
		online: () => typeof navigator !== 'undefined' && navigator.onLine,
		lock:
			typeof navigator !== 'undefined' && navigator.locks
				? new WebLocksLock(navigator.locks)
				: fallbackLock
	}
): Promise<T> {
	const { storage, online, lock } = dependencies;
	requireOnline(online);
	const result = await lock.run(FLUSH_LOCK, { wait: true }, async () => {
		requireOnline(online);
		let records;
		try {
			const [pending, failed] = await Promise.all([
				storage.listPending(userId),
				storage.listFailed(userId)
			]);
			records = [...pending, ...failed];
		} catch {
			throw new BookRemovalGuardError(
				'Non posso verificare gli aggiornamenti locali: IndexedDB non è disponibile. Abilita l’archiviazione del browser e riprova, oppure riapri l’app nel browser usato per leggere.'
			);
		}
		const readings = new Set(readingIds);
		if (records.some((record) => record.userId === userId && readings.has(record.readingId))) {
			throw new BookRemovalGuardError(
				'Questo libro ha aggiornamenti di lettura in attesa o falliti. Sincronizzali o risolvi gli errori nel pannello di sincronizzazione prima di eliminarlo.'
			);
		}
		requireOnline(online);
		return { value: await run() };
	});
	if (!result) {
		throw new BookRemovalGuardError(
			'Non posso verificare la sincronizzazione in corso. Attendi che finisca e riprova.'
		);
	}
	return result.value;
}
