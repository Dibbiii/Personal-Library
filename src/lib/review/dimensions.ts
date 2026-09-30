import type { GenreSlug } from '../contracts/enums';

/**
 * Dimensioni di rating per genere (MASTER_SPEC sez. 11).
 * Le chiavi sono stabili e coincidono con `rating_dimensions.dimension_key` (migration 004);
 * `tests/unit/review-logic.test.ts` verifica la corrispondenza. L'autorità resta il DB:
 * `save_review` rifiuta una chiave che non appartiene al genere del libro.
 */
export const REVIEW_DIMENSIONS_VERSION = 1;

export interface ReviewDimensionDef {
	key: string;
	/** Etichetta completa (come da spec / DB). */
	label: string;
	/** Etichetta nella scheda del libro (mockup 05: "Sistema magico"). */
	shortLabel: string;
}

function dim(key: string, label: string, shortLabel = label): ReviewDimensionDef {
	return { key, label, shortLabel };
}

export const DIMENSIONS_BY_GENRE: Readonly<Record<GenreSlug, readonly ReviewDimensionDef[]>> = {
	classics: [
		dim('classics.style', 'Stile di scrittura'),
		dim('classics.characters', 'Personaggi'),
		dim('classics.themes', 'Temi'),
		dim('classics.pacing', 'Ritmo'),
		dim('classics.impact', 'Impatto')
	],
	'mythology-epic-retelling': [
		dim('mythology.reinterpretation', 'Reinterpretazione'),
		dim('mythology.characters', 'Personaggi'),
		dim('mythology.atmosphere', 'Atmosfera'),
		dim('mythology.pacing', 'Ritmo'),
		dim('mythology.world', 'Mondo mitologico')
	],
	'dystopia-scifi': [
		dim('scifi.concept', 'Concept'),
		dim('scifi.worldbuilding', 'Worldbuilding'),
		dim('scifi.coherence', 'Coerenza'),
		dim('scifi.characters', 'Personaggi'),
		dim('scifi.pacing', 'Ritmo')
	],
	'thriller-mystery': [
		dim('thriller.tension', 'Tensione'),
		dim('thriller.mystery', 'Mistero'),
		dim('thriller.twists', 'Colpi di scena'),
		dim('thriller.pacing', 'Ritmo'),
		dim('thriller.ending', 'Finale')
	],
	'fantasy-magical-gothic': [
		dim('fantasy.worldbuilding', 'Worldbuilding'),
		dim('fantasy.magic', 'Elemento fantastico / Sistema magico', 'Sistema magico'),
		dim('fantasy.characters', 'Personaggi'),
		dim('fantasy.pacing', 'Ritmo'),
		dim('fantasy.atmosphere', 'Atmosfera')
	],
	'romance-ya-na': [
		dim('romance.chemistry', 'Chimica'),
		dim('romance.characters', 'Personaggi'),
		dim('romance.relationship', 'Relazione'),
		dim('romance.emotion', 'Emozione'),
		dim('romance.pacing', 'Ritmo')
	],
	'contemporary-historical': [
		dim('contemporary.characters', 'Personaggi'),
		dim('contemporary.style', 'Stile'),
		dim('contemporary.setting', 'Ambientazione'),
		dim('contemporary.themes', 'Temi'),
		dim('contemporary.emotional', 'Impatto emotivo')
	]
};

export function dimensionsForGenre(genre: GenreSlug): readonly ReviewDimensionDef[] {
	return DIMENSIONS_BY_GENRE[genre];
}

export function dimensionKeysForGenre(genre: GenreSlug): string[] {
	return DIMENSIONS_BY_GENRE[genre].map((d) => d.key);
}

/** Punteggi per chiave di dimensione (1-5). */
export type DimensionScores = Record<string, number>;

/**
 * Anteprima del reset al cambio genere: restano solo i punteggi compatibili col nuovo genere.
 * Le chiavi sono prefissate dal genere, quindi cambiando genere non ne sopravvive nessuna
 * (il DB cancella tutti i `review_scores` della recensione).
 */
export function scoresForGenre(scores: DimensionScores, genre: GenreSlug): DimensionScores {
	const allowed = new Set(dimensionKeysForGenre(genre));
	return Object.fromEntries(Object.entries(scores).filter(([key]) => allowed.has(key)));
}

/** True se passando a `genre` andrebbe perso almeno un punteggio. */
export function wouldResetScores(scores: DimensionScores, genre: GenreSlug): boolean {
	return Object.keys(scores).length > Object.keys(scoresForGenre(scores, genre)).length;
}
