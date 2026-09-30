import { z } from 'zod';
import { bookSummarySchema, genreRefSchema } from './books';
import { contractVersionSchema, nonNegativeIntSchema } from './primitives';
import { bingoBoardResponseSchema } from './rpc';
import { bingoSummarySchema, quotePreviewSchema } from './stats';

/** `list_quotes`: elenco globale delle citazioni (più recenti prima). */
export const quoteListResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	total: nonNegativeIntSchema,
	quotes: z.array(quotePreviewSchema)
});

/** Una card Bingo nell'elenco "Le tue card": riepilogo + posizioni (1..16) completate. */
export const bingoBoardListItemSchema = bingoSummarySchema.extend({
	title: z.string().trim().min(1).nullable(),
	completedPositions: z.array(z.number().int().min(1).max(16))
});

/** `list_bingo_boards`: card dell'utente, anno decrescente. */
export const bingoBoardListResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	boards: z.array(bingoBoardListItemSchema)
});

/** `get_year_genre_breakdown`: letture completate nell'anno per genere, decrescente. */
export const yearGenreBreakdownResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	year: z.number().int().min(1900).max(2200),
	genres: z.array(
		z.object({
			genre: genreRefSchema,
			booksFinished: nonNegativeIntSchema
		})
	)
});

/** `list_completed_books`: libri con almeno una lettura completata (candidati per il Bingo). */
export const completedBooksResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	books: z.array(bookSummarySchema)
});

/** `create_bingo_board`: stessa risposta di `get_bingo_board`. */
export const createBingoBoardResponseSchema = bingoBoardResponseSchema;

export const createBingoBoardInputSchema = z.object({
	year: z.number().int().min(1900).max(2200)
});

export type CompletedBooksResponse = z.infer<typeof completedBooksResponseSchema>;
export type QuoteListResponse = z.infer<typeof quoteListResponseSchema>;
export type BingoBoardListItem = z.infer<typeof bingoBoardListItemSchema>;
export type BingoBoardListResponse = z.infer<typeof bingoBoardListResponseSchema>;
export type YearGenreBreakdownResponse = z.infer<typeof yearGenreBreakdownResponseSchema>;
export type CreateBingoBoardInput = z.infer<typeof createBingoBoardInputSchema>;
