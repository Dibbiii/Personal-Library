/** Normalizzazione testo e similarità per il ranking dei candidati (logica pura). */

const STOPWORDS = new Set([
	'il',
	'lo',
	'la',
	'i',
	'gli',
	'le',
	'l',
	'un',
	'uno',
	'una',
	'di',
	'del',
	'della',
	'dei',
	'delle',
	'dello',
	'degli',
	'e',
	'ed',
	'a',
	'the',
	'an',
	'of',
	'and',
	'les',
	'der',
	'die',
	'das',
	'el',
	'los',
	'las'
]);

/** minuscolo, senza accenti né punteggiatura, spazi singoli. */
export function normalizeText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' e ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Token significativi (senza articoli/preposizioni), se ne restano almeno uno. */
export function tokenize(value: string): string[] {
	const all = normalizeText(value).split(' ').filter(Boolean);
	const significant = all.filter((token) => !STOPWORDS.has(token));
	return significant.length > 0 ? significant : all;
}

/** Coefficiente di Dice sui token, 0..1. 1 = stesso insieme di parole. */
export function tokenSimilarity(a: string, b: string): number {
	const left = new Set(tokenize(a));
	const right = new Set(tokenize(b));
	if (left.size === 0 || right.size === 0) return 0;
	let shared = 0;
	for (const token of left) if (right.has(token)) shared++;
	return (2 * shared) / (left.size + right.size);
}

/**
 * Similarità titolo query vs titolo candidato. Un titolo che contiene tutte le parole cercate
 * (es. "Dune" dentro "Dune. Il ciclo di Dune") vale almeno 0.6, ma meno di un titolo identico.
 */
export function titleSimilarity(query: string, title: string): number {
	const normalizedQuery = normalizeText(query);
	const normalizedTitle = normalizeText(title);
	if (!normalizedQuery || !normalizedTitle) return 0;
	if (normalizedQuery === normalizedTitle) return 1;

	const dice = tokenSimilarity(query, title);
	const queryTokens = tokenize(query);
	const titleTokens = new Set(tokenize(title));
	const containsAll =
		queryTokens.length > 0 && queryTokens.every((token) => titleTokens.has(token));
	return containsAll ? Math.max(dice, 0.6) : dice;
}

/** Miglior corrispondenza fra l'autore cercato e gli autori del candidato (cognome compreso). */
export function authorSimilarity(query: string, authors: readonly string[]): number {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0 || authors.length === 0) return 0;
	let best = 0;
	for (const author of authors) {
		const authorTokens = new Set(tokenize(author));
		if (authorTokens.size === 0) continue;
		const shared = queryTokens.filter((token) => authorTokens.has(token)).length;
		const score = shared / queryTokens.length;
		if (score > best) best = score;
	}
	return best;
}

/** Chiave "stessa stringa": utile per dedupe di duplicati identici del medesimo provider. */
export function textKey(value: string): string {
	return normalizeText(value).replace(/ /g, '');
}
