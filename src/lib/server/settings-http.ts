import { json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { DataAccessError, type DataErrorCode, type SegnalibroRepositories } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';

const STATUS: Record<DataErrorCode, number> = {
	AUTH_REQUIRED: 401,
	NOT_FOUND: 404,
	CONFLICT: 409,
	VALIDATION: 422,
	RATE_LIMITED: 429,
	NETWORK: 503,
	SERVER: 500,
	CONTRACT: 502
};

const MESSAGES: Record<DataErrorCode, string> = {
	AUTH_REQUIRED: 'Sessione scaduta: accedi di nuovo.',
	NOT_FOUND: 'Elemento non trovato.',
	CONFLICT: 'Lo stato è cambiato nel frattempo: ricarica la pagina.',
	VALIDATION: 'Dati non validi.',
	RATE_LIMITED: 'Troppe richieste: riprova fra poco.',
	NETWORK: 'Database non raggiungibile.',
	SERVER: 'Errore del server.',
	CONTRACT: 'Risposta del server non valida.'
};

/** Risposta di errore `{ code, message }` con status coerente al DataErrorCode. */
export function errorResponse(code: DataErrorCode, message?: string): Response {
	return json({ code, message: message ?? MESSAGES[code] }, { status: STATUS[code] });
}

/** Legge e valida il corpo JSON; in caso di errore lancia una Response pronta da restituire. */
export async function parseJsonBody<S extends z.ZodType>(
	request: Request,
	schema: S,
	message = 'Dati non validi.'
): Promise<z.output<S>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw errorResponse('VALIDATION', 'Corpo della richiesta non valido.');
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const first = parsed.error.issues[0]?.message;
		throw errorResponse('VALIDATION', first && first !== 'Invalid input' ? first : message);
	}
	return parsed.data;
}

/** Esegue un handler con repository e gestione errori uniforme. */
export async function withRepository<K extends keyof SegnalibroRepositories>(
	event: RequestEvent,
	repository: K,
	run: (repo: SegnalibroRepositories[K]) => Promise<Response>
): Promise<Response> {
	try {
		if (!event.locals.user) throw new DataAccessError('AUTH_REQUIRED', 'Sessione non valida');
		return await run(requireRepository(event.locals.repos, repository));
	} catch (error) {
		return toErrorResponse(error);
	}
}

export function toErrorResponse(error: unknown): Response {
	if (error instanceof Response) return error;
	if (error instanceof DataAccessError) return errorResponse(error.code);
	console.error('[api] errore inatteso', error);
	return errorResponse('SERVER');
}
