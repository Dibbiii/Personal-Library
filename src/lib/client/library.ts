import { bookRemovalResponseSchema } from '$lib/contracts/library-mutations';
import type { DataErrorCode } from '$lib/data/errors';
import { BookRemovalGuardError } from '$lib/offline/book-removal';
import { apiErrorSchema } from './reading-contract';

export class LibraryApiError extends Error {
	constructor(
		public readonly code: DataErrorCode,
		message: string
	) {
		super(message);
		this.name = 'LibraryApiError';
	}
}

export function describeBookRemovalError(error: unknown): string {
	if (error instanceof BookRemovalGuardError) return error.message;
	if (error instanceof LibraryApiError) return error.message;
	return 'Non sono riuscito a eliminare il libro. Riprova tra poco.';
}

/** La rimozione non viene mai accodata né applicata in modo ottimistico. */
export async function removeBook(bookId: string) {
	let response: Response;
	try {
		response = await fetch('/api/library/remove', {
			method: 'POST',
			mode: 'same-origin',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ bookId })
		});
	} catch {
		throw new LibraryApiError('NETWORK', 'La rete non è disponibile. Riconnettiti e riprova.');
	}

	if (response.redirected || response.status === 401 || response.status === 403) {
		throw new LibraryApiError('AUTH_REQUIRED', 'Sessione scaduta: accedi di nuovo e riprova.');
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new LibraryApiError(
			response.ok ? 'CONTRACT' : 'SERVER',
			'Il server ha restituito una risposta non valida. Ricarica la libreria per verificare lo stato del libro.'
		);
	}
	if (!response.ok) {
		const parsed = apiErrorSchema.safeParse(payload);
		throw parsed.success
			? new LibraryApiError(parsed.data.code, parsed.data.message)
			: new LibraryApiError('SERVER', 'Non sono riuscito a eliminare il libro. Riprova tra poco.');
	}

	const parsed = bookRemovalResponseSchema.safeParse(payload);
	if (!parsed.success || parsed.data.bookId !== bookId) {
		throw new LibraryApiError(
			'CONTRACT',
			'La risposta del server non corrisponde alla rimozione richiesta. Ricarica la libreria per verificare lo stato del libro.'
		);
	}
	return parsed.data;
}
