/**
 * Coda "I prossimi" lato client. Gli altri moduli (dettaglio libro, ruota, Home) usano solo queste
 * funzioni; il dialog del soft limit (mockup 04) e' gestito qui e montato da `QueueConfirmHost`.
 *
 *   addToQueue(bookId, { genre? })  -> 'added' | 'alreadyQueued' | 'cancelled'
 *   removeFromQueue(bookId)         -> coda aggiornata
 *   moveInQueue(bookId, position)   -> coda aggiornata (position 1-based)
 */
import { invalidate } from '$app/navigation';
import {
	queueAddResponseSchema,
	queueMutationResponseSchema,
	type GenreSlug,
	type QueueBook
} from '$lib/contracts';

import { QUEUE_DEPENDENCY } from './queue-keys';

export { QUEUE_DEPENDENCY };

export class QueueRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'QueueRequestError';
	}
}

export type AddToQueueResult =
	| { status: 'added' | 'alreadyQueued'; position: number | null; queue: QueueBook[] }
	| { status: 'cancelled'; position: null; queue: QueueBook[] };

export interface AddToQueueOptions {
	/** Genere del libro: colora lo slot tratteggiato dell'illustrazione del dialog. */
	genre?: GenreSlug;
	/** Chiede conferma oltre il soft limit (default). Con `false` ritorna il 'cancelled' senza scrivere. */
	confirm?: boolean;
	/** Non invalidare la Home dopo la scrittura (la pagina gestisce l'aggiornamento da se'). */
	skipInvalidate?: boolean;
}

async function post<T>(path: string, body: unknown, parse: (json: unknown) => T): Promise<T> {
	let response: Response;
	try {
		response = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		throw new QueueRequestError('NETWORK', 'Connessione assente: riprova fra poco.', 0);
	}
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const error = payload as { code?: string; message?: string } | null;
		throw new QueueRequestError(
			error?.code ?? 'SERVER',
			error?.message ?? 'Operazione non riuscita.',
			response.status
		);
	}
	return parse(payload);
}

function refresh(skip?: boolean) {
	if (!skip) void invalidate(QUEUE_DEPENDENCY);
}

// ---------------------------------------------------------------------------------------------
// Stato del dialog di conferma (letto da QueueConfirmHost)
// ---------------------------------------------------------------------------------------------

class QueueConfirmState {
	open = $state(false);
	busy = $state(false);
	/** Libri gia' in coda (numero reale, N del testo). */
	count = $state(0);
	queue = $state<QueueBook[]>([]);
	genre = $state<GenreSlug | null>(null);

	#confirm: (() => void) | null = null;
	#cancel: (() => void) | null = null;

	show(count: number, queue: QueueBook[], genre: GenreSlug | null) {
		this.#cancel?.();
		this.count = count;
		this.queue = queue;
		this.genre = genre;
		this.busy = false;
		this.open = true;
		return new Promise<'confirm' | 'cancel'>((resolve) => {
			this.#confirm = () => resolve('confirm');
			this.#cancel = () => resolve('cancel');
		});
	}

	confirm() {
		this.#confirm?.();
		this.#confirm = this.#cancel = null;
	}

	cancel() {
		this.#cancel?.();
		this.#confirm = this.#cancel = null;
		this.close();
	}

	close() {
		this.open = false;
		this.busy = false;
	}
}

export const queueConfirm = new QueueConfirmState();

// ---------------------------------------------------------------------------------------------

export async function addToQueue(
	bookId: string,
	options: AddToQueueOptions = {}
): Promise<AddToQueueResult> {
	const call = (force: boolean) =>
		post('/api/queue/add', { bookId, force }, (json) => queueAddResponseSchema.parse(json));

	const first = await call(false);
	if (first.status !== 'requiresConfirmation') {
		refresh(options.skipInvalidate);
		return { status: first.status, position: first.position, queue: first.queue };
	}
	if (options.confirm === false) {
		return { status: 'cancelled', position: null, queue: first.queue };
	}

	const answer = await queueConfirm.show(first.currentCount, first.queue, options.genre ?? null);
	if (answer === 'cancel') return { status: 'cancelled', position: null, queue: first.queue };

	queueConfirm.busy = true;
	try {
		const forced = await call(true);
		refresh(options.skipInvalidate);
		return {
			status: forced.status === 'requiresConfirmation' ? 'added' : forced.status,
			position: forced.position,
			queue: forced.queue
		};
	} finally {
		queueConfirm.close();
	}
}

export async function removeFromQueue(
	bookId: string,
	options: { skipInvalidate?: boolean } = {}
): Promise<QueueBook[]> {
	const result = await post('/api/queue/remove', { bookId }, (json) =>
		queueMutationResponseSchema.parse(json)
	);
	refresh(options.skipInvalidate);
	return result.queue;
}

export async function moveInQueue(
	bookId: string,
	newPosition: number,
	options: { skipInvalidate?: boolean } = {}
): Promise<QueueBook[]> {
	const result = await post('/api/queue/move', { bookId, newPosition }, (json) =>
		queueMutationResponseSchema.parse(json)
	);
	refresh(options.skipInvalidate);
	return result.queue;
}
