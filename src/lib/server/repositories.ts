import type { RpcTransport, SegnalibroRepositories } from '$lib/data';
import { DataAccessError } from '$lib/data';
import { RpcLibraryRepository } from '$lib/data/example-library-repository';
import { RpcExploreRepository } from '$lib/data/explore-repository';
import { RpcQuotesRepository, RpcReviewRepository } from '$lib/data/review-repository';
import { RpcReadingRepository } from '$lib/data/reading-repository';
import { RpcQueueRepository } from '$lib/data/queue-repository';
import { RpcStatsRepository } from '$lib/data/stats-repository';
import { RpcBingoRepository } from '$lib/data/bingo-repository';
import { RpcStatsExtrasRepository } from '$lib/data/stats-extras-repository';
import { RpcThemeRepository } from '$lib/data/theme-repository';
import { RpcSettingsRepository } from '$lib/data/settings-repository';
import { ServerCatalogRepository } from '$lib/data/catalog-repository';

/**
 * Repository disponibili oggi. Le feature aggiungono qui la propria implementazione
 * (una riga per repository) senza toccare le altre: vedi docs/DATA_LAYER.md.
 */
export type Repositories = Pick<SegnalibroRepositories, 'library'> &
	Partial<Omit<SegnalibroRepositories, 'library'>>;

/** `rpc` è il client Postgres dell'utente (createPgRpcClient in src/lib/server/db). */
export function createRepositories(rpc: RpcTransport): Repositories {
	return {
		// RpcLibraryRepository copre getHome/getShelfPage/getGenreView/getBookDetail/changeGenre.
		library: new RpcLibraryRepository(rpc),
		queue: new RpcQueueRepository(rpc),
		reading: new RpcReadingRepository(rpc),
		review: new RpcReviewRepository(rpc),
		quotes: new RpcQuotesRepository(rpc),
		explore: new RpcExploreRepository(rpc),
		stats: new RpcStatsRepository(rpc),
		bingo: new RpcBingoRepository(rpc),
		statsExtras: new RpcStatsExtrasRepository(rpc),
		catalog: new ServerCatalogRepository(),
		themes: new RpcThemeRepository(rpc),
		settings: new RpcSettingsRepository(rpc)
	};
}

/**
 * Accesso ai repository da load e form action (`locals.repos`).
 * Senza utente autenticato o con repository non ancora implementato lancia un errore esplicito.
 */
export function requireRepository<K extends keyof SegnalibroRepositories>(
	repos: Repositories | null,
	name: K
): SegnalibroRepositories[K] {
	if (!repos) throw new DataAccessError('AUTH_REQUIRED', 'Sessione non valida');

	const repository = repos[name];
	if (!repository) {
		throw new Error(
			`Il repository "${name}" non è ancora implementato (src/lib/server/repositories.ts).`
		);
	}
	return repository as SegnalibroRepositories[K];
}
