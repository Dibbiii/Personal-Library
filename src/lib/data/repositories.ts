import type {
	BookDetailResponse,
	BookSearchRequest,
	BookSearchResponse,
	ChangeBookGenreInput,
	GenreViewResponse,
	IsbnLookupRequest,
	LibraryHomeResponse,
	RecordProgressInput,
	ReadingCalendarResponse,
	SaveReviewInput,
	SetThemeInput,
	ShelfPageResponse,
	StartReadingInput,
	StatsDashboardResponse,
	YearStatsResponse,
	AddCompletedReadingInput,
	FinishReadingInput,
	MarkDnfInput,
	QueueMoveInput,
	QueueAddResponse
} from '../contracts/rpc';

import type { GenreSortField, GenreSlug, SortDirection } from '../contracts/enums';

import type { ReadingMutationResult } from '../contracts/readings';

import type {
	AddQuoteInput,
	Quote,
	ReviewReferenceResponse,
	ReviewSaveResult,
	UpdateQuoteInput
} from '../contracts/reviews';

import type { BingoBoard } from '../contracts/stats';

import type {
	BingoBoardListResponse,
	CompletedBooksResponse,
	QuoteListResponse,
	YearGenreBreakdownResponse
} from '../contracts/stats-lists';

import type { ShelfCursor, QueueBook, BookSummary } from '../contracts/books';

import type { ThemeDefinition, ThemeSelection } from '../contracts/themes';

import type { UpdateSettingsInput, UserExport, UserSettings } from '../contracts/settings';

export interface LibraryRepository {
	getHome(options?: { shelfLimit?: number }): Promise<LibraryHomeResponse>;

	getShelfPage(input: {
		genre: GenreSlug;
		cursor?: ShelfCursor;
		limit?: number;
	}): Promise<ShelfPageResponse>;

	getGenreView(input: {
		genre: GenreSlug;
		sortField: GenreSortField;
		direction: SortDirection;
		limit?: number;
		offset?: number;
	}): Promise<GenreViewResponse>;

	getBookDetail(bookId: string): Promise<BookDetailResponse>;

	changeGenre(input: ChangeBookGenreInput): Promise<{
		book: BookSummary;
		reviewScoresReset: boolean;
	}>;
}

export interface QueueRepository {
	add(bookId: string, options?: { force?: boolean }): Promise<QueueAddResponse>;
	remove(bookId: string): Promise<QueueBook[]>;
	move(input: QueueMoveInput): Promise<QueueBook[]>;
}

export interface ReadingRepository {
	start(input: StartReadingInput): Promise<ReadingMutationResult>;

	pause(readingId: string): Promise<ReadingMutationResult>;
	resume(readingId: string): Promise<ReadingMutationResult>;

	recordProgress(input: RecordProgressInput): Promise<ReadingMutationResult>;

	correctProgress(input: RecordProgressInput): Promise<ReadingMutationResult>;

	finish(input: FinishReadingInput): Promise<ReadingMutationResult>;

	markDnf(input: MarkDnfInput): Promise<ReadingMutationResult>;

	addCompletedReading(input: AddCompletedReadingInput): Promise<ReadingMutationResult>;
}

export interface ReviewRepository {
	save(input: SaveReviewInput): Promise<ReviewSaveResult>;
	/** Tag e dimensioni di rating attivi (con gli id dei tag, necessari a `save`). */
	getReference(): Promise<ReviewReferenceResponse>;
}

export interface QuotesRepository {
	add(input: AddQuoteInput): Promise<Quote>;
	update(input: UpdateQuoteInput): Promise<Quote>;
	remove(quoteId: string): Promise<void>;
}

export interface ExploreRepository {
	getPool(input?: { genres?: GenreSlug[] }): Promise<BookSummary[]>;
}

export interface StatsRepository {
	getCalendar(year: number): Promise<ReadingCalendarResponse>;
	getYearStats(year: number): Promise<YearStatsResponse>;
	getDashboard(year: number): Promise<StatsDashboardResponse>;
}

export interface BingoRepository {
	getBoard(year: number): Promise<BingoBoard>;
	assignBook(input: { cellId: string; bookId: string | null }): Promise<BingoBoard>;
	listBoards(): Promise<BingoBoardListResponse>;
	/** Crea la card dell'anno con le 16 sfide di default (CONFLICT se esiste già). */
	createBoard(year: number): Promise<BingoBoard>;
}

/** Letture di Statistiche non coperte da StatsRepository: elenco citazioni e ripartizione generi. */
export interface StatsExtrasRepository {
	listQuotes(input?: {
		bookId?: string;
		limit?: number;
		offset?: number;
	}): Promise<QuoteListResponse>;
	getGenreBreakdown(year: number): Promise<YearGenreBreakdownResponse>;
	/** Libri con almeno una lettura completata, con ricerca opzionale su titolo/autore. */
	listCompletedBooks(input?: { query?: string; limit?: number }): Promise<CompletedBooksResponse>;
}

export interface CatalogRepository {
	search(input: BookSearchRequest): Promise<BookSearchResponse>;
	lookupIsbn(input: IsbnLookupRequest): Promise<BookSearchResponse>;
}

export interface ThemeRepository {
	getSelection(): Promise<ThemeSelection>;
	setSelection(input: SetThemeInput): Promise<ThemeSelection>;

	listBuiltins(): Promise<ThemeDefinition[]>;
	listCustom(): Promise<ThemeDefinition[]>;

	saveCustom(theme: ThemeDefinition): Promise<ThemeDefinition>;
	deleteCustom(themeId: string): Promise<void>;
}

/** Impostazioni account (nome, scaffali, movimento) e export dati (privacy, spec §41). */
export interface SettingsRepository {
	get(): Promise<UserSettings>;
	update(input: UpdateSettingsInput): Promise<UserSettings>;
	exportData(): Promise<UserExport>;
}

export interface SegnalibroRepositories {
	settings: SettingsRepository;
	library: LibraryRepository;
	queue: QueueRepository;
	reading: ReadingRepository;
	review: ReviewRepository;
	quotes: QuotesRepository;
	explore: ExploreRepository;
	stats: StatsRepository;
	bingo: BingoRepository;
	statsExtras: StatsExtrasRepository;
	catalog: CatalogRepository;
	themes: ThemeRepository;
}
