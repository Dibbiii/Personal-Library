import { z } from 'zod';
import { progressEventTypeSchema, readingStatusSchema } from './enums';
import { isoTimestampSchema, localDateSchema, pageNumberSchema, uuidSchema } from './primitives';

export const readingSchema = z.object({
	id: uuidSchema,
	userBookId: uuidSchema,

	status: readingStatusSchema,

	startedAt: isoTimestampSchema,
	endedAt: isoTimestampSchema.nullable(),

	startPage: pageNumberSchema,
	currentPage: pageNumberSchema
});

export const readingHistoryItemSchema = readingSchema.extend({
	/**
	 * 1 = prima lettura, 2 = prima rilettura, ...
	 * È un valore di presentazione derivato dall'ordine delle letture.
	 */
	sequence: z.number().int().positive()
});

export const progressEventSchema = z.object({
	id: uuidSchema,
	readingId: uuidSchema,
	type: progressEventTypeSchema,

	page: pageNumberSchema,

	/**
	 * Delta contabile applicato alle statistiche.
	 * Può essere negativo per una correzione.
	 */
	pageDelta: z.number().int(),

	localDate: localDateSchema,
	occurredAt: isoTimestampSchema
});

export const readingMutationResultSchema = z.object({
	contractVersion: z.literal(1),
	reading: readingSchema,
	duplicate: z.boolean().default(false)
});

export type Reading = z.infer<typeof readingSchema>;
export type ReadingHistoryItem = z.infer<typeof readingHistoryItemSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type ReadingMutationResult = z.infer<typeof readingMutationResultSchema>;
