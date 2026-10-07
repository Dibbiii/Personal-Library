import type { z } from 'zod';
import type { DataErrorCode } from '$lib/data/errors';
import { readingMutationResultSchema, type ReadingMutationResult } from '$lib/contracts/readings';
import type { BookFormat, GenreSlug } from '$lib/contracts/enums';
import {
	newEventId,
	OutboxRejectedError,
	submitReadingOp as submitToOutbox
} from '$lib/offline/outbox';
import {
	apiErrorSchema,
	changeFormatResponseSchema,
	changeGenreResponseSchema,
	type AddCompletedRequest,
	type ChangeFormatResponse,
	type ChangeGenreResponse,
	type ReadingEventRequest,
	type StartReadingRequest
} from './reading-contract';

/**
 * Client HTTP per gli endpoint /api/reading/* e /api/books/[id]/*.
 * Gli errori portano un `code` (DataErrorCode): la UI reagisce al codice, mai al testo.
 */

export class ReadingApiError extends Error {
	constructor(
		public readonly code: DataErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ReadingApiError';
	}
}

/** Testi italiani per codice errore, da mostrare all'utente. */
export function describeReadingError(error: unknown): string {
	const code = error instanceof ReadingApiError ? error.code : 'SERVER';
	switch (code) {
		case 'AUTH_REQUIRED':
			return 'Sessione scaduta: accedi di nuovo.';
		case 'NOT_FOUND':
			return 'Non trovo più questo libro o questa lettura. Ricarica la pagina.';
		case 'CONFLICT':
			return 'Lo stato della lettura è cambiato nel frattempo. Ricarica la pagina e riprova.';
		case 'VALIDATION':
			return 'I dati inseriti non sono validi. Controlla pagine e date.';
		case 'RATE_LIMITED':
			return 'Troppe richieste ravvicinate. Riprova fra qualche secondo.';
		case 'NETWORK':
			return 'Sei offline o il server non risponde. Riprova tra poco.';
		case 'CONTRACT':
		case 'SERVER':
			return 'Qualcosa è andato storto. Riprova tra poco.';
	}
}

async function request<S extends z.ZodType>(
	url: string,
	method: 'POST' | 'PATCH',
	body: unknown,
	schema: S
): Promise<z.output<S>> {
	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		throw new ReadingApiError('NETWORK', 'Rete non disponibile');
	}

	// Sessione scaduta: la guardia reindirizza al login e fetch segue il redirect.
	if (response.redirected && new URL(response.url).pathname.startsWith('/auth/')) {
		throw new ReadingApiError('AUTH_REQUIRED', 'Sessione scaduta');
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new ReadingApiError(response.ok ? 'CONTRACT' : 'SERVER', 'Risposta non valida');
	}

	if (!response.ok) {
		const parsed = apiErrorSchema.safeParse(payload);
		throw parsed.success
			? new ReadingApiError(parsed.data.code, parsed.data.message)
			: new ReadingApiError('SERVER', 'Errore del server');
	}

	const parsed = schema.safeParse(payload);
	if (!parsed.success) throw new ReadingApiError('CONTRACT', 'Risposta fuori contratto');
	return parsed.data;
}

export const startReading = (input: StartReadingRequest) =>
	request('/api/reading/start', 'POST', input, readingMutationResultSchema);

export const pauseReading = (readingId: string) =>
	request('/api/reading/pause', 'POST', { readingId }, readingMutationResultSchema);

export const resumeReading = (readingId: string) =>
	request('/api/reading/resume', 'POST', { readingId }, readingMutationResultSchema);

export const addCompletedReading = (input: AddCompletedRequest) =>
	request('/api/reading/add-completed', 'POST', input, readingMutationResultSchema);

export const changeBookGenre = (
	bookId: string,
	genreSlug: GenreSlug
): Promise<ChangeGenreResponse> =>
	request(
		`/api/books/${encodeURIComponent(bookId)}/genre`,
		'PATCH',
		{ genreSlug },
		changeGenreResponseSchema
	);

export const changeBookFormat = (
	bookId: string,
	format: BookFormat
): Promise<ChangeFormatResponse> =>
	request(
		`/api/books/${encodeURIComponent(bookId)}/format`,
		'PATCH',
		{ format },
		changeFormatResponseSchema
	);

export interface ReadingOpResult {
	status: 'synced' | 'queued';
	result?: ReadingMutationResult;
}

const KNOWN_CODES = new Set<DataErrorCode>([
	'AUTH_REQUIRED',
	'NOT_FOUND',
	'CONFLICT',
	'VALIDATION',
	'RATE_LIMITED',
	'NETWORK',
	'SERVER',
	'CONTRACT'
]);

function codeFromRejection(error: OutboxRejectedError): DataErrorCode {
	if (error.code && KNOWN_CODES.has(error.code as DataErrorCode))
		return error.code as DataErrorCode;
	if (error.status === 404) return 'NOT_FOUND';
	if (error.status === 409) return 'CONFLICT';
	return 'VALIDATION';
}

/**
 * progress / correction / finish / dnf: passano sempre dall'outbox offline (IndexedDB) di
 * `$lib/offline/outbox`. Offline o con il server in errore l'evento resta in coda (`queued`) e
 * parte da solo al ritorno della rete; un rifiuto permanente del server diventa un ReadingApiError.
 */
export async function submitReadingOp(op: ReadingEventRequest): Promise<ReadingOpResult> {
	try {
		const outcome = await submitToOutbox(op);
		if (outcome.status === 'queued') return { status: 'queued' };
		const parsed = readingMutationResultSchema.safeParse(outcome.result);
		return parsed.success ? { status: 'synced', result: parsed.data } : { status: 'synced' };
	} catch (error) {
		if (error instanceof OutboxRejectedError) {
			throw new ReadingApiError(codeFromRejection(error), error.message);
		}
		throw new ReadingApiError('SERVER', "Impossibile registrare l'aggiornamento.");
	}
}

export { newEventId };
