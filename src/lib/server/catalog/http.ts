import { DataAccessError } from '$lib/data/errors';

export const PROVIDER_TIMEOUT_MS = 7000;
const MAX_BODY_CHARS = 2_000_000;
const USER_AGENT = 'Segnalibro/0.1 (libreria personale; contatto: self-hosted)';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchJsonOptions {
	fetch?: FetchLike | undefined;
	/** Solo questi host (nessun fetch di URL arbitrari) */
	allowedHosts: readonly string[];
	signal?: AbortSignal | undefined;
	timeoutMs?: number | undefined;
}

/**
 * GET JSON verso un host in allow-list, con timeout. `null` su 404 (risorsa assente).
 * Errori mappati: 429 -> RATE_LIMITED, timeout/rete/5xx -> NETWORK, altro -> SERVER.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<unknown | null> {
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' || !options.allowedHosts.includes(parsed.hostname)) {
		throw new DataAccessError('VALIDATION', `Host non consentito: ${parsed.hostname}`);
	}

	const timeout = AbortSignal.timeout(options.timeoutMs ?? PROVIDER_TIMEOUT_MS);
	const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
	const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

	let response: Response;
	try {
		response = await doFetch(url, {
			headers: { accept: 'application/json', 'user-agent': USER_AGENT },
			signal,
			redirect: 'follow'
		});
	} catch (error) {
		const aborted =
			error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
		throw new DataAccessError(
			'NETWORK',
			aborted ? 'Il servizio non ha risposto in tempo' : 'Servizio non raggiungibile',
			error
		);
	}

	// Un redirect non deve portarci fuori dall'allow-list.
	if (response.url) {
		try {
			const finalHost = new URL(response.url).hostname;
			if (!options.allowedHosts.includes(finalHost)) {
				throw new DataAccessError('VALIDATION', `Redirect non consentito: ${finalHost}`);
			}
		} catch (error) {
			if (error instanceof DataAccessError) throw error;
		}
	}

	if (response.status === 404) return null;
	if (response.status === 429) {
		throw new DataAccessError('RATE_LIMITED', 'Troppe richieste al servizio di catalogo');
	}
	if (response.status >= 500) {
		throw new DataAccessError('NETWORK', `Il servizio ha risposto ${response.status}`);
	}
	if (!response.ok) {
		throw new DataAccessError('SERVER', `Il servizio ha risposto ${response.status}`);
	}

	try {
		const text = await response.text();
		if (text.length > MAX_BODY_CHARS) throw new Error('risposta troppo grande');
		return JSON.parse(text) as unknown;
	} catch (error) {
		throw new DataAccessError('CONTRACT', 'Risposta del catalogo non valida', error);
	}
}
