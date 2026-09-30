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
  QueueAddResponse,
} from '../contracts/rpc';

import type {
  GenreSortField,
  GenreSlug,
  SortDirection,
} from '../contracts/enums';

import type {
  ReadingMutationResult,
} from '../contracts/readings';

import type {
  ReviewSaveResult,
} from '../contracts/reviews';

import type {
  BingoBoard,
} from '../contracts/stats';

import type {
  ShelfCursor,
  QueueBook,
  BookSummary,
} from '../contracts/books';

import type {
  ThemeDefinition,
  ThemeSelection,
} from '../contracts/themes';

export interface LibraryRepository {
  getHome(options?: {
    shelfLimit?: number;
  }): Promise<LibraryHomeResponse>;

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

  recordProgress(
    input: RecordProgressInput,
  ): Promise<ReadingMutationResult>;

  correctProgress(
    input: RecordProgressInput,
  ): Promise<ReadingMutationResult>;

  finish(
    input: FinishReadingInput,
  ): Promise<ReadingMutationResult>;

  markDnf(
    input: MarkDnfInput,
  ): Promise<ReadingMutationResult>;

  addCompletedReading(
    input: AddCompletedReadingInput,
  ): Promise<ReadingMutationResult>;
}

export interface ReviewRepository {
  save(input: SaveReviewInput): Promise<ReviewSaveResult>;
}

export interface ExploreRepository {
  getPool(input?: {
    genres?: GenreSlug[];
  }): Promise<BookSummary[]>;
}

export interface StatsRepository {
  getCalendar(year: number): Promise<ReadingCalendarResponse>;
  getYearStats(year: number): Promise<YearStatsResponse>;
  getDashboard(year: number): Promise<StatsDashboardResponse>;
}

export interface BingoRepository {
  getBoard(year: number): Promise<BingoBoard>;
  assignBook(input: {
    cellId: string;
    bookId: string | null;
  }): Promise<BingoBoard>;
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

export interface SegnalibroRepositories {
  library: LibraryRepository;
  queue: QueueRepository;
  reading: ReadingRepository;
  review: ReviewRepository;
  explore: ExploreRepository;
  stats: StatsRepository;
  bingo: BingoRepository;
  catalog: CatalogRepository;
  themes: ThemeRepository;
}
