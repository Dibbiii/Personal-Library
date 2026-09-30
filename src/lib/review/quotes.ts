/** Logica pura delle citazioni (MASTER_SPEC sez. 13). */
export const QUOTE_BODY_MAX = 5000;
export const QUOTE_PAGE_MAX = 99999;

/** Toglie le virgolette che l'utente ha scritto intorno al testo: la UI le aggiunge («…»). */
export function normalizeQuoteBody(raw: string): string {
	let text = raw.normalize('NFC').trim();
	for (let i = 0; i < 2; i += 1) {
		const match = /^[«“"„‟'‘]\s*([\s\S]*?)\s*[»”"‟'’]$/u.exec(text);
		if (!match || match[1] === undefined) break;
		text = match[1].trim();
	}
	return text;
}

export type QuoteFormError = 'body-empty' | 'body-too-long' | 'page-invalid';

export const QUOTE_ERROR_MESSAGES: Record<QuoteFormError, string> = {
	'body-empty': 'Scrivi il testo della citazione.',
	'body-too-long': `Massimo ${QUOTE_BODY_MAX} caratteri.`,
	'page-invalid': 'La pagina deve essere un numero maggiore di zero.'
};

export type QuoteFormResult =
	{ ok: true; body: string; page: number | null } | { ok: false; error: QuoteFormError };

/** Valida testo e pagina (facoltativa) del form. */
export function parseQuoteForm(rawBody: string, rawPage: string): QuoteFormResult {
	const body = normalizeQuoteBody(rawBody);
	if (!body) return { ok: false, error: 'body-empty' };
	if (body.length > QUOTE_BODY_MAX) return { ok: false, error: 'body-too-long' };

	const pageText = rawPage.trim();
	if (pageText === '') return { ok: true, body, page: null };
	if (!/^\d+$/.test(pageText)) return { ok: false, error: 'page-invalid' };
	const page = Number(pageText);
	if (page < 1 || page > QUOTE_PAGE_MAX) return { ok: false, error: 'page-invalid' };
	return { ok: true, body, page };
}

/** Più recenti per prime, come restituite dal DB. */
export function sortQuotes<T extends { createdAt: string; id: string }>(quotes: readonly T[]): T[] {
	return [...quotes].sort((a, b) =>
		a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)
	);
}
