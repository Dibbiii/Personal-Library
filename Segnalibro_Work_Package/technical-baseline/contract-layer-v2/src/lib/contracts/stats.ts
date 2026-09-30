import { z } from 'zod';
import { bookSummarySchema, genreRefSchema } from './books';
import {
  isoTimestampSchema,
  localDateSchema,
  nonEmptyTextSchema,
  positiveIntSchema,
  uuidSchema,
} from './primitives';
import { quoteSchema } from './reviews';

export const calendarGenreSliceSchema = z.object({
  genre: genreRefSchema,
  /**
   * Utile per un conic-gradient proporzionale se in futuro si desidera pesare
   * i segmenti sulle pagine lette. In V1 la UI può ignorarlo e dividere in parti uguali.
   */
  pagesRead: z.number().int().nonnegative(),
});

export const readingCalendarDaySchema = z.object({
  date: localDateSchema,
  pagesRead: z.number().int().nonnegative(),
  genres: z.array(calendarGenreSliceSchema).min(1),
});

export const topTagStatSchema = z.object({
  id: positiveIntSchema,
  slug: z.string().trim().min(1),
  label: nonEmptyTextSchema,
  count: z.number().int().nonnegative(),
});

export const authorStatSchema = z.object({
  name: nonEmptyTextSchema,
  booksFinished: z.number().int().nonnegative(),
});

export const goldenMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  booksFinished: z.number().int().nonnegative(),
});

export const yearStatsSchema = z.object({
  year: z.number().int().min(1900).max(2200),

  booksFinished: z.number().int().nonnegative(),
  pagesRead: z.number().int().nonnegative(),
  readingDays: z.number().int().nonnegative(),

  currentStreak: z.number().int().nonnegative(),
  recordStreak: z.number().int().nonnegative(),

  topGenre: z
    .object({
      genre: genreRefSchema,
      booksFinished: z.number().int().nonnegative(),
    })
    .nullable(),

  topAuthor: authorStatSchema.nullable(),
  goldenMonth: goldenMonthSchema.nullable(),

  topTags: z.array(topTagStatSchema),
});

export const bingoCellSchema = z.object({
  id: uuidSchema,
  position: z.number().int().min(1).max(16),
  challenge: nonEmptyTextSchema,

  completedAt: isoTimestampSchema.nullable(),
  book: bookSummarySchema.nullable(),
});

export const bingoBoardSchema = z.object({
  id: uuidSchema,
  year: z.number().int().min(1900).max(2200),
  title: z.string().trim().min(1).nullable(),

  completedCount: z.number().int().min(0).max(16),
  cells: z.array(bingoCellSchema).length(16),
});

export const bingoSummarySchema = z.object({
  boardId: uuidSchema,
  year: z.number().int().min(1900).max(2200),
  completedCount: z.number().int().min(0).max(16),
  totalCount: z.literal(16),
});

export const dnfBookSchema = z.object({
  book: bookSummarySchema,
  stoppedAtPage: positiveIntSchema.nullable(),
  dnfAt: isoTimestampSchema.nullable(),
});

export const quotePreviewSchema = quoteSchema.extend({
  bookTitle: nonEmptyTextSchema,
  author: nonEmptyTextSchema,
  genre: genreRefSchema,
});

export type ReadingCalendarDay = z.infer<typeof readingCalendarDaySchema>;
export type YearStats = z.infer<typeof yearStatsSchema>;
export type BingoCell = z.infer<typeof bingoCellSchema>;
export type BingoBoard = z.infer<typeof bingoBoardSchema>;
export type BingoSummary = z.infer<typeof bingoSummarySchema>;
export type DnfBook = z.infer<typeof dnfBookSchema>;
export type QuotePreview = z.infer<typeof quotePreviewSchema>;
