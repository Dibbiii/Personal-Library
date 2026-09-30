import type { BookSummary, GenreSlug } from '$lib/contracts';
import { resolveBuiltinTheme } from '$lib/themes';
import { buildSpine, type BookStatusBadge, type SpineColorSource, type SpineSpec } from './spine';

/** Colori reali del tema attivo, usati solo per scegliere l'inchiostro dei dorsi/cover. */
export function spineColorSource(genre: GenreSlug, themeKey?: string | null): SpineColorSource {
	const theme = resolveBuiltinTheme(themeKey);
	const palette = theme.genres[genre];
	return {
		base: palette.base,
		dark: palette.dark,
		white: theme.colors.onGenreWhite,
		ink: theme.colors.onGenreInk,
		shadow: theme.colors.shadow
	};
}

/** Stato mostrato come badge sul libro: solo "in lettura" (lifecycle) e "prossimo" (coda). */
export function bookStatus(
	book: Pick<BookSummary, 'lifecycleState'>,
	queued = false
): BookStatusBadge | null {
	if (book.lifecycleState === 'reading') return 'reading';
	return queued ? 'next' : null;
}

/** Specifica deterministica di dorso/cover per un libro (funzione pura, cache per chiave). */
export function spineSpecFor(
	book: BookSummary,
	status: BookStatusBadge | null,
	themeKey?: string | null
): SpineSpec {
	return buildSpine(
		{
			bookId: book.id,
			title: book.title,
			author: book.author,
			genre: book.genre.slug,
			pages: book.pageCount,
			format: book.format,
			status
		},
		spineColorSource(book.genre.slug, themeKey)
	);
}
