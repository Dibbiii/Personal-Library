import { json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { DataAccessError, type DataErrorCode } from '$lib/data';
import { requireRepository } from '$lib/server/repositories';
import type { SegnalibroRepositories } from '$lib/data';

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
export async function parseBody<S extends z.ZodType>(
	request: Request,
	schema: S
): Promise<z.output<S>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw errorResponse('VALIDATION', 'Corpo della richiesta non valido.');
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) throw errorResponse('VALIDATION', 'Dati non validi.');
	return parsed.data;
}

/**
 * Esegue un handler con repository e gestione errori uniforme.
 * Le Response lanciate da parseBody passano così come sono.
 */
export async function handle<K extends keyof SegnalibroRepositories>(
	event: RequestEvent,
	repository: K,
	run: (repo: SegnalibroRepositories[K]) => Promise<Response>
): Promise<Response> {
	try {
		if (!event.locals.user) throw new DataAccessError('AUTH_REQUIRED', 'Sessione non valida');
		return await run(requireRepository(event.locals.repos, repository));
	} catch (error) {
		if (error instanceof Response) return error;
		if (error instanceof DataAccessError) return errorResponse(error.code);
		console.error('[api] errore inatteso', error);
		return errorResponse('SERVER');
	}
}
