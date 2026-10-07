import { DataAccessError } from '$lib/data/errors';
import type { EditionCandidate } from '$lib/contracts/books';
import type { BookSearchRequest } from '$lib/contracts/rpc';
import { CATALOG_TTL, TtlCache } from '$lib/catalog/cache';
import { parseIsbn } from '$lib/catalog/isbn';
import { dedupeCandidates } from '$lib/catalog/merge';
import {
	hasIsbnMatch,
	isStrongIsbnMatch,
	rankCandidates,
	topCandidates
} from '$lib/catalog/ranking';
import { normalizeText } from '$lib/catalog/text';
import type {
	BookProvider,
	CatalogProviderId,
	CatalogSearchResult,
	IsbnLookupResult,
	ProviderStatus
} from '$lib/catalog/types';

export interface CatalogServiceOptions {
	/** In ordine di priorità dei campi in caso di fusione (Open Library prima). */
	providers: readonly BookProvider[];
	maxCandidates?: number;
	now?: () => number;
}

interface Collected {
	candidates: EditionCandidate[];
	providers: Partial<Record<CatalogProviderId, ProviderStatus>>;
	failures: DataAccessError[];
}

function toDataError(reason: unknown): DataAccessError {
	return reason instanceof DataAccessError
		? reason
		: new DataAccessError('NETWORK', 'Servizio non raggiungibile', reason);
}

/**
 * Orchestra i provider: chiamate in parallelo, un provider giù non blocca l'altro, dedupe per
 * identità forte, ranking, cache con TTL. Nessun accesso a database o utente.
 */
export class CatalogService {
	private readonly searchCache: TtlCache<CatalogSearchResult>;
	private readonly isbnCache: TtlCache<IsbnLookupResult>;
	private readonly maxCandidates: number;

	constructor(private readonly options: CatalogServiceOptions) {
		const now = options.now;
		this.searchCache = new TtlCache({ maxEntries: 500, ...(now ? { now } : {}) });
		this.isbnCache = new TtlCache({ maxEntries: 1000, ...(now ? { now } : {}) });
		this.maxCandidates = options.maxCandidates ?? 5;
	}

	clearCache(): void {
		this.searchCache.clear();
		this.isbnCache.clear();
	}

	private async collect(
		call: (provider: BookProvider) => Promise<EditionCandidate[]>
	): Promise<Collected> {
		const settled = await Promise.allSettled(
			this.options.providers.map((provider) => call(provider))
		);
		const collected: Collected = { candidates: [], providers: {}, failures: [] };

		settled.forEach((result, index) => {
			const provider = this.options.providers[index] as BookProvider;
			if (result.status === 'fulfilled') {
				collected.providers[provider.id] = 'ok';
				collected.candidates.push(...result.value);
			} else {
				const error = toDataError(result.reason);
				collected.providers[provider.id] = error.code === 'RATE_LIMITED' ? 'rate_limited' : 'error';
				collected.failures.push(error);
			}
		});

		if (
			collected.failures.length === this.options.providers.length &&
			collected.failures.length > 0
		) {
			const allRateLimited = collected.failures.every((failure) => failure.code === 'RATE_LIMITED');
			throw new DataAccessError(
				allRateLimited ? 'RATE_LIMITED' : 'NETWORK',
				allRateLimited
					? 'I servizi di catalogo sono momentaneamente sovraccarichi'
					: 'I servizi di catalogo non sono raggiungibili',
				collected.failures[0]
			);
		}
		return collected;
	}

	async search(request: BookSearchRequest): Promise<CatalogSearchResult> {
		const key = [request.title, request.author ?? '', request.language ?? '']
			.map((part) => normalizeText(part))
			.join('|');

		return this.searchCache.getOrLoad(
			`search:${key}`,
			async () => {
				const collected = await this.collect((provider) => provider.search(request));
				const ranked = rankCandidates(dedupeCandidates(collected.candidates), {
					title: request.title,
					// Nel campo unico il testo può identificare autore o editore: il titolo resta
					// comunque il segnale con peso maggiore nel ranking.
					author: request.author ?? request.title,
					publisher: request.title,
					language: request.language
				});
				// Niente rumore: si tengono i candidati pertinenti a titolo, autore o editore.
				const relevant = ranked.filter((candidate) =>
					candidate.matchReasons.some(
						(reason) =>
							reason === 'title-exact' ||
							reason === 'title-match' ||
							reason === 'author-match' ||
							reason === 'publisher-match'
					)
				);
				return {
					candidates: topCandidates(relevant.length > 0 ? relevant : ranked, this.maxCandidates),
					degraded: collected.failures.length > 0,
					providers: collected.providers
				};
			},
			(value) =>
				value.degraded
					? CATALOG_TTL.degraded
					: value.candidates.length > 0
						? CATALOG_TTL.search
						: CATALOG_TTL.isbnMiss
		);
	}

	async lookupIsbn(input: string): Promise<IsbnLookupResult> {
		const parsed = parseIsbn(input);
		if (!parsed) throw new DataAccessError('VALIDATION', 'ISBN non valido');
		const { isbn13 } = parsed;

		return this.isbnCache.getOrLoad(
			`isbn:${isbn13}`,
			async () => {
				const collected = await this.collect((provider) => provider.lookupIsbn(isbn13));
				const ranked = rankCandidates(dedupeCandidates(collected.candidates), { isbn13 });
				// Se c'è l'edizione con lo stesso ISBN si mostra solo quella; altrimenti il meglio disponibile.
				const exact = ranked.filter((candidate) => hasIsbnMatch(candidate, isbn13));
				const candidates = topCandidates(exact.length > 0 ? exact : ranked, this.maxCandidates);
				return {
					candidates,
					degraded: collected.failures.length > 0,
					providers: collected.providers,
					exactMatch: isStrongIsbnMatch(candidates, isbn13)
				};
			},
			(value) =>
				value.degraded
					? CATALOG_TTL.degraded
					: value.candidates.length > 0
						? CATALOG_TTL.isbnHit
						: CATALOG_TTL.isbnMiss
		);
	}
}
