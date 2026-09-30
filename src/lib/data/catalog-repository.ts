/**
 * Implementazione server del repository `catalog`: orchestra provider esterni (cache + ranking),
 * scrive il catalogo solo tramite `upsertCatalogEdition` e crea/aggiorna i `user_books` dell'utente.
 * Va importata solo da codice server (hooks, `+server.ts`, `+page.server.ts`).
 *
 * I metodi di scrittura ricevono l'id utente della SESSIONE: non arriva mai dall'input.
 */
import type { CatalogRepository } from './repositories';
import { DataAccessError } from './errors';
import type { BookSearchRequest, BookSearchResponse, IsbnLookupRequest } from '../contracts/rpc';
import { openLibraryCoverByIsbn } from '../catalog/covers';
import { parseIsbn } from '../catalog/isbn';
import { parsePublishedDate } from '../catalog/published-date';
import type {
	AddBookInput,
	AddBookResponse,
	CoverAlternative,
	IsbnLookupResponse,
	CatalogSearchResponse
} from '../catalog/schemas';
import { getCatalogService, type CatalogService } from '../server/catalog';
import { mapPgError, upsertCatalogEdition, withUser, type Tx } from '../server/db';
import { deleteCover, saveCover, type CoverInput, type SavedCover } from '../server/storage';

interface BookRow {
	id: string;
	title: string;
	author_display: string;
	isbn_10: string | null;
	isbn_13: string | null;
	language: string | null;
	cover_url: string | null;
	cover_storage_path: string | null;
}

export interface CoverState {
	coverUrl: string | null;
	coverStoragePath: string | null;
}

export class ServerCatalogRepository implements CatalogRepository {
	constructor(private readonly service: CatalogService = getCatalogService()) {}

	// --- Ricerca ---------------------------------------------------------------------------------

	async searchDetailed(input: BookSearchRequest): Promise<CatalogSearchResponse> {
		const result = await this.service.search(input);
		return { contractVersion: 1, ...result };
	}

	async lookupIsbnDetailed(input: IsbnLookupRequest): Promise<IsbnLookupResponse> {
		const result = await this.service.lookupIsbn(input.isbn);
		return { contractVersion: 1, ...result };
	}

	async search(input: BookSearchRequest): Promise<BookSearchResponse> {
		const { contractVersion, candidates } = await this.searchDetailed(input);
		return { contractVersion, candidates };
	}

	async lookupIsbn(input: IsbnLookupRequest): Promise<BookSearchResponse> {
		const { contractVersion, candidates } = await this.lookupIsbnDetailed(input);
		return { contractVersion, candidates };
	}

	// --- Aggiunta alla libreria ------------------------------------------------------------------

	async addBook(userId: string, input: AddBookInput): Promise<AddBookResponse> {
		const isbn = input.isbn ? parseIsbn(input.isbn) : null;
		if (input.isbn && !isbn) throw new DataAccessError('VALIDATION', 'ISBN non valido');

		try {
			const duplicate = await withUser(userId, (tx) =>
				findDuplicate(tx, {
					isbn10: isbn?.isbn10 ?? null,
					isbn13: isbn?.isbn13 ?? null,
					editionId: null,
					title: input.title,
					author: input.author,
					includeTitleMatch: !input.force
				})
			);
			if (duplicate) return duplicate;

			let editionId: string | null = null;
			if (input.edition) {
				const published = parsePublishedDate(input.edition.publishedDate);
				const ids = input.edition.providerIds;
				const result = await upsertCatalogEdition(userId, {
					title: input.edition.workTitle,
					authors: input.edition.authors,
					openLibraryWorkId: ids.openLibraryWorkId,
					openLibraryEditionId: ids.openLibraryEditionId,
					googleBooksId: ids.googleBooksId,
					isbn10: isbn?.isbn10 ?? null,
					isbn13: isbn?.isbn13 ?? null,
					language: input.language,
					publisher: input.edition.publisher,
					publishedDate: published.date,
					publishedYear: published.year,
					pageCount: input.pageCount,
					coverProvider: input.coverUrl ? input.edition.provider : null,
					coverUrl: input.coverUrl
				});
				editionId = result.editionId;

				// La stessa edizione può essere già in libreria senza ISBN (id del provider).
				const again = await withUser(userId, (tx) =>
					findDuplicate(tx, {
						isbn10: null,
						isbn13: null,
						editionId,
						title: input.title,
						author: input.author,
						includeTitleMatch: false
					})
				);
				if (again) return again;
			}

			return await withUser(userId, async (tx) => {
				const rows = await tx<{ id: string }[]>`
					insert into public.user_books (
						user_id, edition_id, genre_id, title, author_display, page_count, language,
						isbn_10, isbn_13, format, series_name, series_number, series_total,
						cover_url, source
					)
					select
						${userId}::uuid, ${editionId}::bigint, g.id, ${input.title}::text, ${input.author}::text,
						${input.pageCount}::integer, ${input.language}::text,
						${isbn?.isbn10 ?? null}::text, ${isbn?.isbn13 ?? null}::text, ${input.format}::text,
						${input.series?.name ?? null}::text, ${input.series?.number ?? null}::numeric,
						${input.series?.total ?? null}::smallint, ${input.coverUrl}::text, ${input.source}::text
					from public.genres g
					where g.slug = ${input.genre} and g.is_active
					returning id::text
				`;
				const row = rows[0];
				if (!row) throw new DataAccessError('VALIDATION', 'Genere non valido');
				return { status: 'added' as const, bookId: row.id };
			});
		} catch (error) {
			throw normalizeError(error);
		}
	}

	// --- Cover -----------------------------------------------------------------------------------

	/** Cover alternative dai provider per un libro dell'utente (per ISBN, poi per titolo/autore). */
	async listCoverAlternatives(
		userId: string,
		bookId: string
	): Promise<{ alternatives: CoverAlternative[]; degraded: boolean }> {
		const book = await this.loadBook(userId, bookId);
		const alternatives = new Map<string, CoverAlternative>();
		let degraded = false;

		const add = (
			candidates: {
				coverUrl: string | null;
				provider: CoverAlternative['provider'];
				publisher: string | null;
				publishedDate: string | null;
				editionTitle: string;
			}[]
		) => {
			for (const candidate of candidates) {
				if (!candidate.coverUrl || alternatives.has(candidate.coverUrl)) continue;
				const meta = [candidate.publisher, parsePublishedDate(candidate.publishedDate).year]
					.filter(Boolean)
					.join(' · ');
				alternatives.set(candidate.coverUrl, {
					url: candidate.coverUrl,
					provider: candidate.provider,
					label: meta || candidate.editionTitle
				});
			}
		};

		const isbn13 =
			book.isbn_13 ?? (book.isbn_10 ? (parseIsbn(book.isbn_10)?.isbn13 ?? null) : null);
		const tasks: Promise<void>[] = [];
		if (isbn13) {
			tasks.push(
				this.service.lookupIsbn(isbn13).then((result) => {
					degraded ||= result.degraded;
					add(result.candidates);
				})
			);
		}
		tasks.push(
			this.service
				.search({
					title: book.title,
					author: book.author_display,
					...(book.language ? { language: book.language } : {})
				})
				.then((result) => {
					degraded ||= result.degraded;
					add(result.candidates);
				})
		);

		const settled = await Promise.allSettled(tasks);
		if (settled.every((task) => task.status === 'rejected')) {
			throw settled[0]?.status === 'rejected' && settled[0].reason instanceof DataAccessError
				? settled[0].reason
				: new DataAccessError('NETWORK', 'Servizi di catalogo non raggiungibili');
		}
		degraded ||= settled.some((task) => task.status === 'rejected');

		if (isbn13) {
			// La cover per ISBN di Open Library può esistere anche se i metadati non la citano:
			// l'interfaccia scarta le immagini che non si caricano.
			const url = openLibraryCoverByIsbn(isbn13, 'L');
			if (!alternatives.has(url)) {
				alternatives.set(url, { url, provider: 'open-library', label: 'Open Library (per ISBN)' });
			}
		}

		return { alternatives: [...alternatives.values()].slice(0, 8), degraded };
	}

	/** L'utente sceglie una cover di un provider: sostituisce l'eventuale cover caricata. */
	async selectProviderCover(userId: string, bookId: string, coverUrl: string): Promise<CoverState> {
		const previous = await this.updateCover(
			userId,
			bookId,
			(tx) => tx`
			update public.user_books
			set cover_url = ${coverUrl}::text, cover_storage_path = null
			where id = ${bookId}::uuid
			returning cover_url, cover_storage_path
		`
		);
		await this.dropFile(userId, previous.oldPath);
		return previous.state;
	}

	async setCustomCover(userId: string, bookId: string, file: CoverInput): Promise<CoverState> {
		await this.loadBook(userId, bookId); // 404 se non è suo, prima di scrivere il file
		const saved: SavedCover = await saveCover(userId, file);
		try {
			const result = await this.updateCover(
				userId,
				bookId,
				(tx) => tx`
				update public.user_books
				set cover_storage_path = ${saved.path}::text
				where id = ${bookId}::uuid
				returning cover_url, cover_storage_path
			`
			);
			await this.dropFile(userId, result.oldPath);
			return result.state;
		} catch (error) {
			await deleteCover(saved.path, userId).catch(() => false);
			throw normalizeError(error);
		}
	}

	async removeCustomCover(userId: string, bookId: string): Promise<CoverState> {
		const result = await this.updateCover(
			userId,
			bookId,
			(tx) => tx`
			update public.user_books
			set cover_storage_path = null
			where id = ${bookId}::uuid
			returning cover_url, cover_storage_path
		`
		);
		await this.dropFile(userId, result.oldPath);
		return result.state;
	}

	// --- Interni ---------------------------------------------------------------------------------

	private async loadBook(userId: string, bookId: string): Promise<BookRow> {
		try {
			const rows = await withUser(
				userId,
				(tx) => tx<BookRow[]>`
				select id::text, title, author_display, isbn_10, isbn_13, language, cover_url, cover_storage_path
				from public.user_books
				where id = ${bookId}::uuid
			`
			);
			const row = rows[0];
			if (!row) throw new DataAccessError('NOT_FOUND', 'Libro non trovato');
			return row;
		} catch (error) {
			throw normalizeError(error);
		}
	}

	private async updateCover(
		userId: string,
		bookId: string,
		run: (tx: Tx) => PromiseLike<{ cover_url: string | null; cover_storage_path: string | null }[]>
	): Promise<{ state: CoverState; oldPath: string | null }> {
		try {
			return await withUser(userId, async (tx) => {
				const before = await tx<{ cover_storage_path: string | null }[]>`
					select cover_storage_path from public.user_books where id = ${bookId}::uuid for update
				`;
				if (!before[0]) throw new DataAccessError('NOT_FOUND', 'Libro non trovato');
				const after = await run(tx);
				const row = after[0];
				if (!row) throw new DataAccessError('NOT_FOUND', 'Libro non trovato');
				return {
					state: { coverUrl: row.cover_url, coverStoragePath: row.cover_storage_path },
					oldPath: before[0].cover_storage_path
				};
			});
		} catch (error) {
			throw normalizeError(error);
		}
	}

	/** Cancella il vecchio file dopo il commit; un errore qui non deve far fallire l'operazione. */
	private async dropFile(userId: string, path: string | null): Promise<void> {
		if (!path) return;
		await deleteCover(path, userId).catch(() => false);
	}
}

function normalizeError(error: unknown): Error {
	if (error instanceof DataAccessError) return error;
	if (typeof error === 'object' && error !== null && 'code' in error) return mapPgError(error);
	return error instanceof Error ? error : new DataAccessError('SERVER', 'Errore imprevisto', error);
}

interface DuplicateQuery {
	isbn10: string | null;
	isbn13: string | null;
	editionId: string | null;
	title: string;
	author: string;
	includeTitleMatch: boolean;
}

async function findDuplicate(tx: Tx, query: DuplicateQuery): Promise<AddBookResponse | null> {
	if (query.isbn10 || query.isbn13 || query.editionId) {
		const rows = await tx<{ id: string; title: string; author_display: string }[]>`
			select id::text, title, author_display
			from public.user_books
			where (${query.editionId}::bigint is not null and edition_id = ${query.editionId}::bigint)
				or (${query.isbn13}::text is not null and isbn_13 = ${query.isbn13}::text)
				or (${query.isbn10}::text is not null and isbn_10 = ${query.isbn10}::text)
			order by created_at
			limit 1
		`;
		const row = rows[0];
		if (row) {
			return {
				status: 'duplicate',
				exact: true,
				existing: { id: row.id, title: row.title, author: row.author_display }
			};
		}
	}

	if (query.includeTitleMatch) {
		const rows = await tx<{ id: string; title: string; author_display: string }[]>`
			select id::text, title, author_display
			from public.user_books
			where lower(btrim(title)) = lower(btrim(${query.title}::text))
				and lower(btrim(author_display)) = lower(btrim(${query.author}::text))
			order by created_at
			limit 1
		`;
		const row = rows[0];
		if (row) {
			return {
				status: 'duplicate',
				exact: false,
				existing: { id: row.id, title: row.title, author: row.author_display }
			};
		}
	}
	return null;
}
