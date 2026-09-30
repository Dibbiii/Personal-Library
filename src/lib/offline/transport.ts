import type { OutboxRecord, SendOutcome } from './types';

/** Endpoint del tracking di lettura (B2). Idempotente per `eventId`. */
export const READING_EVENT_ENDPOINT = '/api/reading/event';
export const SEND_TIMEOUT_MS = 12_000;

export interface ResponseLike {
	status: number;
	type?: string;
	redirected?: boolean;
	contentType?: string | null;
}

/** Classificazione pura dello status HTTP (testata in unit). */
export function classifyResponse(
	response: ResponseLike
): 'ok' | 'auth' | 'retry' | 'rejected' | 'invalid-ok' {
	if (response.type === 'opaqueredirect' || response.redirected) return 'auth';

	const { status } = response;
	if (status >= 200 && status < 300) {
		// Un 2xx non JSON (captive portal, proxy) non è un ack del nostro server.
		return (response.contentType ?? '').includes('json') ? 'ok' : 'invalid-ok';
	}
	if (status === 401 || status === 403) return 'auth';
	if (status === 408 || status === 425 || status === 429) return 'retry';
	if (status >= 500) return 'retry';
	return 'rejected';
}

function requestBody(record: OutboxRecord): string {
	return JSON.stringify({
		eventId: record.eventId,
		readingId: record.readingId,
		page: record.page,
		occurredAt: record.occurredAt,
		localDate: record.localDate,
		operation: record.operation
	});
}

async function readErrorBody(response: Response): Promise<{ message?: string; code?: string }> {
	try {
		const data: unknown = await response.json();
		if (typeof data === 'object' && data !== null) {
			const { message, code } = data as { message?: unknown; code?: unknown };
			return {
				...(typeof message === 'string' ? { message } : {}),
				...(typeof code === 'string' ? { code } : {})
			};
		}
	} catch {
		// corpo non JSON
	}
	return {};
}

/** POST dell'evento. Non lancia mai: ogni fallimento diventa un SendOutcome. */
export async function sendReadingOp(
	record: OutboxRecord,
	fetchImpl: typeof fetch = fetch,
	endpoint: string = READING_EVENT_ENDPOINT
): Promise<SendOutcome> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetchImpl(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: requestBody(record),
			credentials: 'same-origin',
			// Il guard di sessione risponde con un redirect al login: non seguirlo (sarebbe un 200 HTML).
			redirect: 'manual',
			signal: controller.signal
		});
	} catch {
		return { kind: 'network' };
	} finally {
		clearTimeout(timer);
	}

	const kind = classifyResponse({
		status: response.status,
		type: response.type,
		redirected: response.redirected,
		contentType: response.headers.get('content-type')
	});

	switch (kind) {
		case 'ok': {
			try {
				return { kind: 'ok', body: (await response.json()) as unknown };
			} catch {
				// 2xx JSON ma corpo illeggibile: non è un ack affidabile, si ritenta (idempotente)
				return { kind: 'retry', status: response.status };
			}
		}
		case 'auth':
			return { kind: 'auth' };
		case 'invalid-ok':
			return { kind: 'retry', status: response.status };
		case 'retry':
			return { kind: 'retry', status: response.status };
		case 'rejected': {
			const { message, code } = await readErrorBody(response);
			return {
				kind: 'rejected',
				status: response.status,
				reason: message ?? `Il server ha rifiutato l'aggiornamento (HTTP ${response.status})`,
				...(code ? { code } : {})
			};
		}
	}
}
