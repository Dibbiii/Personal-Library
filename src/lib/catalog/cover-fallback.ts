import { TtlCache } from './cache';
import { openLibraryCoverByIsbn } from './covers';
import { parseIsbn } from './isbn';

/** Browser-session cache and budget; this does not fetch bibliographic data. */
export class IsbnCoverFallback {
	private readonly cache: TtlCache<'pending' | 'ready' | 'missing'>;
	private hits: number[] = [];

	constructor(private readonly now: () => number = Date.now) {
		this.cache = new TtlCache({ maxEntries: 250, now });
	}

	acquire(isbn: string | null | undefined): string | null {
		const parsed = parseIsbn(isbn ?? '');
		if (!parsed) return null;
		const url = openLibraryCoverByIsbn(parsed.isbn13);
		const cached = this.cache.get(url);
		if (cached === 'missing') return null;
		if (cached) return url;
		const now = this.now();
		this.hits = this.hits.filter((time) => time > now - 5 * 60_000);
		// Open Library allows 100 ISBN-cover requests/IP per five minutes.
		// Leave room for other cover requests; this budget is per browser session.
		if (this.hits.length >= 80) return null;
		this.hits.push(now);
		this.cache.set(url, 'pending', 30_000);
		return url;
	}

	settle(url: string, found: boolean): void {
		this.cache.set(url, found ? 'ready' : 'missing', found ? 12 * 60 * 60_000 : 60_000);
	}
}

export const isbnCoverFallback = new IsbnCoverFallback();
