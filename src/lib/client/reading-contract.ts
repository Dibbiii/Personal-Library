import { z } from 'zod';
import { genreSlugSchema } from '$lib/contracts/enums';
import {
	isoTimestampSchema,
	localDateSchema,
	pageNumberSchema,
	uuidSchema
} from '$lib/contracts/primitives';
import {
	addCompletedReadingInputSchema,
	readingIdInputSchema,
	startReadingInputSchema
} from '$lib/contracts/rpc';

/**
 * Contratto JSON degli endpoint /api/reading/* e /api/books/[id]/genre.
 * Importabile sia dal server (validazione in ingresso) sia dal client (tipi e parsing in uscita).
 */

export const readingOperationSchema = z.enum(['progress', 'correction', 'finish', 'dnf']);
export type ReadingOperation = z.infer<typeof readingOperationSchema>;

/** Corpo di POST /api/reading/event: è anche il formato dell'outbox offline (MASTER_SPEC §9). */
export const readingEventRequestSchema = z.object({
	eventId: uuidSchema,
	readingId: uuidSchema,
	page: pageNumberSchema,
	occurredAt: isoTimestampSchema,
	localDate: localDateSchema,
	operation: readingOperationSchema
});
export type ReadingEventRequest = z.infer<typeof readingEventRequestSchema>;

export const startReadingRequestSchema = startReadingInputSchema;
export type StartReadingRequest = z.input<typeof startReadingRequestSchema>;

export const readingIdRequestSchema = readingIdInputSchema;

export const addCompletedRequestSchema = addCompletedReadingInputSchema;
export type AddCompletedRequest = z.input<typeof addCompletedRequestSchema>;

export const changeGenreRequestSchema = z.object({ genreSlug: genreSlugSchema });
export type ChangeGenreRequest = z.infer<typeof changeGenreRequestSchema>;

export const changeGenreResponseSchema = z.object({
	contractVersion: z.literal(1),
	reviewScoresReset: z.boolean(),
	genreSlug: genreSlugSchema
});
export type ChangeGenreResponse = z.infer<typeof changeGenreResponseSchema>;

export const apiErrorSchema = z.object({
	code: z.enum([
		'AUTH_REQUIRED',
		'NOT_FOUND',
		'CONFLICT',
		'VALIDATION',
		'RATE_LIMITED',
		'NETWORK',
		'SERVER',
		'CONTRACT'
	]),
	message: z.string()
});
export type ApiError = z.infer<typeof apiErrorSchema>;
