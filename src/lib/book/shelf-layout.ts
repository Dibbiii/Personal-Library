import type { BookSummary, GenreSlug } from '$lib/contracts';
import { fnv1a, type BookStatusBadge, type SpineSpec } from './spine';
import { bookStatus, spineSpecFor } from './palette';

export type DecorationKind =
	| 'plant'
	| 'candle'
	| 'mug'
	| 'stack'
	| 'vase'
	| 'globe'
	| 'bust'
	| 'succulent'
	| 'cactus'
	| 'trailing'
	| 'fern'
	| 'hourglass'
	| 'lantern'
	| 'bookends'
	| 'figurine';

/** Una decorazione per scaffale, ciclo fisso come nel mockup. */
export const SHELF_DECORATION: Record<GenreSlug, DecorationKind> = {
	classics: 'plant',
	'mythology-epic-retelling': 'candle',
	'dystopia-scifi': 'mug',
	'thriller-mystery': 'stack',
	'fantasy-magical-gothic': 'plant',
	'romance-ya-na': 'candle',
	'contemporary-historical': 'stack',
	essays: 'globe'
};

export type ShelfItem =
	| {
			kind: 'cover';
			key: string;
			book: BookSummary;
			status: BookStatusBadge | null;
			/** Cover evidenziata senza immagine reale (nessun download per gli scaffali). */
			noImage: boolean;
	  }
	| {
			kind: 'spine';
			key: string;
			book: BookSummary;
			status: BookStatusBadge | null;
			lean: boolean;
			spec: SpineSpec;
	  }
	| { kind: 'deco'; key: string; deco: DecorationKind };

export interface ShelfLayoutInput {
	books: readonly BookSummary[];
	genre: GenreSlug;
	/** Id dei libri nella coda "I prossimi". */
	queuedIds: ReadonlySet<string>;
	themeKey?: string | null;
}

/**
 * Compone uno scaffale come nel mockup (docs/mockup/SPINES.md, sez. 6):
 * libri con stato in testa (la prima cover con badge e ogni "in lettura" di fronte, gli altri dorsi con
 * badge sopra), libri normali come dorsi (ogni tanto uno "evidenziato" di fronte), una decorazione dopo il
 * 2°-5° elemento e al piu' un libro appoggiato subito prima della decorazione.
 */
export function layoutShelf({ books, genre, queuedIds, themeKey }: ShelfLayoutInput): ShelfItem[] {
	const withStatus: { book: BookSummary; status: BookStatusBadge }[] = [];
	const others: { book: BookSummary; status: null }[] = [];
	for (const book of books) {
		const status = bookStatus(book, queuedIds.has(book.id));
		if (status) withStatus.push({ book, status });
		else others.push({ book, status: null });
	}
	// "In lettura" prima dei "Prossimi", l'ordine di libreria resta invariato dentro ciascun gruppo.
	withStatus.sort((a, b) => Number(b.status === 'reading') - Number(a.status === 'reading'));

	let statusCover = false;
	const items: ShelfItem[] = [];
	for (const { book, status } of [...withStatus, ...others]) {
		const spec = spineSpecFor(book, status, themeKey);
		const asCover = status ? status === 'reading' || !statusCover : spec.featured;
		if (asCover) {
			if (status) statusCover = true;
			items.push({ kind: 'cover', key: book.id, book, status, noImage: status === null });
		} else {
			items.push({ kind: 'spine', key: book.id, book, status, lean: false, spec });
		}
	}

	if (items.length === 0) return items;

	const position = Math.min(items.length, 2 + (fnv1a(`deco|${genre}`) % 4));
	const before = items[position - 1];
	if (before?.kind === 'spine' && shouldLean(genre, before, items[0])) before.lean = true;
	items.splice(position, 0, { kind: 'deco', key: `deco-${genre}`, deco: SHELF_DECORATION[genre] });
	return items;
}

function shouldLean(
	genre: GenreSlug,
	item: Extract<ShelfItem, { kind: 'spine' }>,
	first?: ShelfItem
) {
	if (item.spec.spine.lean) return true;
	return fnv1a(`lean|${genre}|${first?.key ?? ''}`) % 7 < 3;
}
