import type { EditionCandidate } from '$lib/contracts/books';
import { isbn13To10, parseIsbn } from './isbn';
import { toIso2 } from './language';
import { authorSimilarity, titleSimilarity } from './text';

/** Numero massimo di candidati mostrati quando l'edizione non è certa (spec sez. 19: 3-5). */
export const MAX_CANDIDATES = 5;

export interface RankingQuery {
	title?: string | undefined;
	author?: string | undefined;
	/** Preferenza, non filtro */
	language?: string | undefined;
	isbn13?: string | undefined;
}

/**
 * Codici motivo in `matchReasons` (la UI li traduce):
 * isbn-exact, title-exact, title-match, author-match, language-match, has-cover, complete-metadata.
 */
export type MatchReason =
	| 'isbn-exact'
	| 'title-exact'
	| 'title-match'
	| 'author-match'
	| 'language-match'
	| 'has-cover'
	| 'complete-metadata';

/**
 * Pesi nell'ordine della specifica: ISBN > titolo > autore > lingua > cover > pagine/editore/data.
 * L'ISBN esatto è in più un criterio di precedenza assoluta in `rankCandidates`.
 */
const WEIGHTS = {
	isbn: 0.3,
	title: 0.34,
	author: 0.12,
	language: 0.1,
	cover: 0.08,
	meta: 0.06
} as const;

export function hasIsbnMatch(candidate: EditionCandidate, isbn13: string): boolean {
	if (candidate.isbn13 === isbn13) return true;
	const isbn10 = isbn13To10(isbn13);
	return isbn10 !== null && candidate.isbn10 === isbn10;
}

export function scoreCandidate(
	candidate: EditionCandidate,
	query: RankingQuery
): { confidence: number; reasons: MatchReason[] } {
	const reasons: MatchReason[] = [];
	let score = 0;
	let applicable = 0;

	if (query.isbn13) {
		applicable += WEIGHTS.isbn;
		if (hasIsbnMatch(candidate, query.isbn13)) {
			score += WEIGHTS.isbn;
			reasons.push('isbn-exact');
		}
	}

	if (query.title) {
		applicable += WEIGHTS.title;
		const similarity = Math.max(
			titleSimilarity(query.title, candidate.editionTitle),
			titleSimilarity(query.title, candidate.workTitle)
		);
		// Solo il titolo identico prende il peso pieno: un titolo solo simile non supera mai
		// "titolo esatto" grazie all'autore (priorità titolo > autore).
		score += WEIGHTS.title * (similarity >= 0.999 ? 1 : similarity * 0.8);
		if (similarity >= 0.999) reasons.push('title-exact');
		else if (similarity >= 0.5) reasons.push('title-match');
	}

	if (query.author) {
		applicable += WEIGHTS.author;
		const similarity = authorSimilarity(query.author, candidate.authors);
		score += WEIGHTS.author * similarity;
		if (similarity >= 0.5) reasons.push('author-match');
	}

	const preferredLanguage = toIso2(query.language);
	if (preferredLanguage) {
		applicable += WEIGHTS.language;
		if (toIso2(candidate.language) === preferredLanguage) {
			score += WEIGHTS.language;
			reasons.push('language-match');
		}
	}

	applicable += WEIGHTS.cover;
	if (candidate.coverUrl) {
		score += WEIGHTS.cover;
		reasons.push('has-cover');
	}

	applicable += WEIGHTS.meta;
	const metaFields = [candidate.pageCount, candidate.publisher, candidate.publishedDate];
	const metaPresent = metaFields.filter((value) => value !== null && value !== '').length;
	score += (WEIGHTS.meta * metaPresent) / metaFields.length;
	if (metaPresent === metaFields.length) reasons.push('complete-metadata');

	const confidence = applicable === 0 ? 0 : Math.min(1, Math.max(0, score / applicable));
	return { confidence: Math.round(confidence * 1000) / 1000, reasons };
}

/**
 * Assegna confidence/matchReasons e ordina dal migliore: prima chi ha l'ISBN cercato, poi per
 * punteggio, a parità ordine d'arrivo (stabile).
 */
export function rankCandidates(
	candidates: readonly EditionCandidate[],
	query: RankingQuery
): EditionCandidate[] {
	return candidates
		.map((candidate, index) => {
			const { confidence, reasons } = scoreCandidate(candidate, query);
			return { candidate: { ...candidate, confidence, matchReasons: reasons }, index };
		})
		.sort((a, b) => {
			const exactA = a.candidate.matchReasons.includes('isbn-exact') ? 1 : 0;
			const exactB = b.candidate.matchReasons.includes('isbn-exact') ? 1 : 0;
			return (
				exactB - exactA || b.candidate.confidence - a.candidate.confidence || a.index - b.index
			);
		})
		.map((entry) => entry.candidate);
}

/** I migliori N (3-5) candidati. Mai fusioni: solo taglio della lista ordinata. */
export function topCandidates(
	ranked: readonly EditionCandidate[],
	max: number = MAX_CANDIDATES
): EditionCandidate[] {
	return ranked.slice(0, Math.max(1, max));
}

/**
 * Preselezione automatica: SOLO con ISBN cercato uguale a quello del candidato migliore.
 * Titolo + autore, per quanto simili, non bastano mai.
 */
export function isStrongIsbnMatch(ranked: readonly EditionCandidate[], isbn13: string): boolean {
	const best = ranked[0];
	return best !== undefined && parseIsbn(isbn13) !== null && hasIsbnMatch(best, isbn13);
}
