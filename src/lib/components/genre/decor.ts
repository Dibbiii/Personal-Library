import type { DecorationKind } from '$lib/book/shelf-layout';
import type { GenreSlug } from '$lib/contracts';

/** Oggetti a tema per genere: tre sulla mensola del banner, gli ultimi due in fondo agli scaffali. */
export const GENRE_DECOR: Record<
	GenreSlug,
	readonly [DecorationKind, DecorationKind, DecorationKind]
> = {
	classics: ['globe', 'stack', 'fern'],
	'mythology-epic-retelling': ['bust', 'candle', 'vase'],
	'dystopia-scifi': ['hourglass', 'succulent', 'cactus'],
	'thriller-mystery': ['lantern', 'stack', 'hourglass'],
	'fantasy-magical-gothic': ['lantern', 'candle', 'trailing'],
	'romance-ya-na': ['figurine', 'mug', 'trailing'],
	'contemporary-historical': ['bookends', 'mug', 'cactus'],
	essays: ['globe', 'stack', 'fern']
};
