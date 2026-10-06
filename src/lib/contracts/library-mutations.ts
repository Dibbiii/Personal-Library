import { z } from 'zod';
import { contractVersionSchema, nonNegativeIntSchema, uuidSchema } from './primitives';

export const removeBookRequestSchema = z.object({ bookId: uuidSchema }).strict();

export const bookRemovalResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	bookId: uuidSchema,
	readingIds: z.array(uuidSchema),
	clearedBingoCells: nonNegativeIntSchema
});

/** Il percorso della cover serve solo al server per la pulizia del filesystem. */
export const bookRemovalResultSchema = bookRemovalResponseSchema.extend({
	coverStoragePath: z.string().nullable()
});

export type BookRemovalResponse = z.infer<typeof bookRemovalResponseSchema>;
export type BookRemovalResult = z.infer<typeof bookRemovalResultSchema>;
