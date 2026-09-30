/** I 3 aggettivi della recensione (MASTER_SPEC sez. 10). */
export const ADJECTIVE_COUNT = 3;
export const ADJECTIVE_MAX_LENGTH = 24;

export type AdjectiveError = 'empty' | 'too-long' | 'duplicate' | 'full';

export const ADJECTIVE_ERROR_MESSAGES: Record<AdjectiveError, string> = {
	empty: 'Scrivi un aggettivo.',
	'too-long': `Massimo ${ADJECTIVE_MAX_LENGTH} caratteri.`,
	duplicate: 'Hai già usato questo aggettivo.',
	full: 'Ne bastano 3: rimuovine uno per cambiarlo.'
};

/** Trim, spazi interni compattati, prima lettera maiuscola (come "Epico" nel mockup). */
export function normalizeAdjective(raw: string): string {
	const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
	if (!text) return '';
	const [first = '', ...rest] = Array.from(text);
	return first.toLocaleUpperCase('it') + rest.join('');
}

/** Confronto senza maiuscole, come il controllo del DB (`lower(a)`). */
export function adjectiveKey(value: string): string {
	return value.normalize('NFC').trim().toLocaleLowerCase('it');
}

export type AddAdjectiveResult =
	{ ok: true; adjectives: string[] } | { ok: false; error: AdjectiveError };

export function addAdjective(current: readonly string[], raw: string): AddAdjectiveResult {
	const value = normalizeAdjective(raw);
	if (!value) return { ok: false, error: 'empty' };
	if (Array.from(value).length > ADJECTIVE_MAX_LENGTH) return { ok: false, error: 'too-long' };
	if (current.length >= ADJECTIVE_COUNT) return { ok: false, error: 'full' };
	const key = adjectiveKey(value);
	if (current.some((a) => adjectiveKey(a) === key)) return { ok: false, error: 'duplicate' };
	return { ok: true, adjectives: [...current, value] };
}

export function removeAdjective(current: readonly string[], index: number): string[] {
	return current.filter((_, i) => i !== index);
}

/** Esattamente 3, non vuoti, distinti senza distinguere le maiuscole. */
export function areAdjectivesValid(adjectives: readonly string[]): boolean {
	if (adjectives.length !== ADJECTIVE_COUNT) return false;
	const keys = adjectives.map(adjectiveKey);
	return keys.every((k) => k.length > 0) && new Set(keys).size === ADJECTIVE_COUNT;
}
