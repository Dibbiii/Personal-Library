import type { CoverRef } from '$lib/contracts/books';

/**
 * Host dai quali accettiamo URL di cover (nessun fetch di URL arbitrari: SSRF e tracking).
 * Coincide con i domini restituiti dai due provider.
 */
export const COVER_HOSTS: readonly string[] = [
	'covers.openlibrary.org',
	'books.google.com',
	'books.googleusercontent.com',
	'inventaire.io'
];

export const MAX_COVER_URL_LENGTH = 600;

export function isAllowedCoverUrl(value: string | null | undefined): value is string {
	if (!value || value.length > MAX_COVER_URL_LENGTH) return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			url.username === '' &&
			url.password === '' &&
			(url.port === '' || url.port === '443') &&
			COVER_HOSTS.includes(url.hostname)
		);
	} catch {
		return false;
	}
}

/** Google restituisce spesso http:// e `edge=curl` (angolo piegato): si passa a https e si toglie. */
export function normalizeCoverUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value.replace(/^http:\/\//i, 'https://'));
		url.searchParams.delete('edge');
		const normalized = url.toString();
		return isAllowedCoverUrl(normalized) ? normalized : null;
	} catch {
		return null;
	}
}

export type OpenLibraryCoverSize = 'S' | 'M' | 'L';

export function openLibraryCoverById(id: number | string, size: OpenLibraryCoverSize = 'L') {
	return `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(id))}-${size}.jpg`;
}

/** `default=false` fa rispondere 404 invece di un'immagine 1x1 quando la cover non esiste. */
export function openLibraryCoverByIsbn(isbn: string, size: OpenLibraryCoverSize = 'L') {
	return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;
}

/** URL dell'endpoint che serve una cover caricata dall'utente. */
export function customCoverUrl(coverStoragePath: string): string {
	return `/api/covers/${coverStoragePath}`;
}

/**
 * Precedenza (spec sez. 19): 1) cover personalizzata, 2) URL del provider, 3) `null`
 * = placeholder locale.
 */
export function coverSrc(
	cover: CoverRef | { coverUrl: string | null; coverStoragePath: string | null }
) {
	if (cover.coverStoragePath) return customCoverUrl(cover.coverStoragePath);
	if (cover.coverUrl) return cover.coverUrl;
	return null;
}
