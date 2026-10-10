import { json, type RequestEvent } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { DataAccessError, type DataErrorCode } from '$lib/data/errors';
import { ServerCatalogRepository } from '$lib/data/catalog-repository';
import { requireRepository } from '$lib/server/repositories';
import { StorageError } from '../storage';
import { RateLimiter } from './rate-limit';

const STATUS: Record<DataErrorCode, number> = {
	AUTH_REQUIRED: 401,
	NOT_FOUND: 404,
	CONFLICT: 409,
	VALIDATION: 422,
	RATE_LIMITED: 429,
	NETWORK: 502,
	SERVER: 500,
	CONTRACT: 502
};

const GENERIC_MESSAGE: Record<DataErrorCode, string> = {
	AUTH_REQUIRED: 'Accedi per continuare.',
	NOT_FOUND: 'Non abbiamo trovato quello che cercavi.',
	CONFLICT: 'Qualcosa è cambiato nel frattempo, riprova.',
	VALIDATION: 'I dati inviati non sono validi.',
	RATE_LIMITED: 'Troppe richieste, riprova fra qualche istante.',
	NETWORK: 'Servizio momentaneamente non raggiungibile, riprova.',
	SERVER: 'Qualcosa è andato storto, riprova.',
	CONTRACT: 'Risposta inattesa dal servizio, riprova.'
};

const STORAGE_MESSAGE: Record<string, { status: number; message: string }> = {
	empty: { status: 422, message: 'Il file è vuoto.' },
	too_large: { status: 413, message: 'L’immagine supera i 5 MB.' },
	unsupported_type: { status: 415, message: 'Formato non supportato: usa PNG, JPEG o WebP.' },
	invalid_path: { status: 404, message: GENERIC_MESSAGE.NOT_FOUND },
	forbidden: { status: 404, message: GENERIC_MESSAGE.NOT_FOUND }
};

export interface ApiErrorBody {
	code: DataErrorCode;
	message: string;
	field?: string;
}

function body(code: DataErrorCode, message: string, field?: string): ApiErrorBody {
	return field ? { code, message, field } : { code, message };
}

export function errorResponse(error: unknown, headers?: HeadersInit): Response {
	if (error instanceof Response) return error;

	if (error instanceof ZodError) {
		const issue = error.issues[0];
		const field = issue?.path.map(String).join('.') || undefined;
		return json(body('VALIDATION', issue?.message ?? GENERIC_MESSAGE.VALIDATION, field), {
			status: 422,
			...(headers ? { headers } : {})
		});
	}

	if (error instanceof StorageError) {
		const mapped = STORAGE_MESSAGE[error.reason] ?? {
			status: 422,
			message: GENERIC_MESSAGE.VALIDATION
		};
		return json(body('VALIDATION', mapped.message), { status: mapped.status });
	}

	if (error instanceof DataAccessError) {
		// I messaggi "nostri" (senza causa) sono in italiano e sicuri; quelli del database non si espongono.
		const safe = error.cause === undefined || error.code === 'NOT_FOUND';
		const message =
			safe && error.code === 'VALIDATION' ? error.message : GENERIC_MESSAGE[error.code];
		return json(body(error.code, message), {
			status: STATUS[error.code],
			...(headers ? { headers } : {})
		});
	}

	console.error('[api/catalog] errore non gestito', error);
	return json(body('SERVER', GENERIC_MESSAGE.SERVER), { status: 500 });
}

export function requireUserId(event: RequestEvent): string {
	const user = event.locals.user;
	if (!user) throw new DataAccessError('AUTH_REQUIRED', 'Sessione non valida');
	return user.id;
}

export function getCatalogRepository(event: RequestEvent): ServerCatalogRepository {
	const repository = requireRepository(event.locals.repos, 'catalog');
	if (!(repository instanceof ServerCatalogRepository)) {
		throw new DataAccessError('SERVER', 'Repository catalog non configurato');
	}
	return repository;
}

// Per processo e per utente: bastano a fermare loop del client e abusi banali.
const limiters = {
	search: new RateLimiter({ windowMs: 60_000, max: 40 }),
	// Esplora apre 5 sezioni insieme e i filtri cambiano spesso: limite più largo.
	discover: new RateLimiter({ windowMs: 60_000, max: 90 }),
	add: new RateLimiter({ windowMs: 60_000, max: 20 }),
	edit: new RateLimiter({ windowMs: 60_000, max: 20 }),
	cover: new RateLimiter({ windowMs: 60_000, max: 15 })
} as const;

export function enforceRateLimit(kind: keyof typeof limiters, userId: string): void {
	const result = limiters[kind].consume(`${kind}:${userId}`);
	if (!result.allowed) {
		throw json(body('RATE_LIMITED', GENERIC_MESSAGE.RATE_LIMITED), {
			status: 429,
			headers: { 'retry-after': String(result.retryAfterSeconds) }
		});
	}
}

export async function readJsonBody(request: Request): Promise<unknown> {
	const type = request.headers.get('content-type') ?? '';
	if (!type.toLowerCase().startsWith('application/json')) {
		throw json(body('VALIDATION', 'Formato della richiesta non supportato.'), { status: 415 });
	}
	try {
		return await request.json();
	} catch {
		throw json(body('VALIDATION', 'Richiesta non valida.'), { status: 400 });
	}
}

/** Risposte di sola lettura per-utente: niente cache condivise. */
export const PRIVATE_NO_STORE = { 'cache-control': 'private, no-store' } as const;
