import type { CoverRef } from '$lib/contracts';

/**
 * URL dell'immagine di copertina: cover caricata dall'utente > URL del provider > nessuna.
 * `coverStoragePath` e' il percorso relativo salvato a DB (`covers/<userId>/<uuid>.jpg`),
 * servito dall'endpoint `/api/covers/<path>` (feature "aggiungi libro").
 */
export function resolveCoverUrl(cover: CoverRef): string | null {
	if (cover.coverStoragePath) {
		const encoded = cover.coverStoragePath
			.split('/')
			.map((part) => encodeURIComponent(part))
			.join('/');
		return `/api/covers/${encoded}`;
	}
	return cover.coverUrl;
}
