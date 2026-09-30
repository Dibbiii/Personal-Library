import { z } from 'zod';

/**
 * Regole del boundary API:
 * - UUID restano stringhe UUID.
 * - ID PostgreSQL bigint vengono normalizzati a stringa per evitare perdita di
 *   precisione JavaScript.
 * - timestamptz = ISO-8601 con timezone.
 * - date = YYYY-MM-DD.
 */

export const contractVersionSchema = z.literal(1);

export const uuidSchema = z.string().uuid();

export const catalogIdSchema = z
	.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive().safe()])
	.transform(String);

export const isoTimestampSchema = z.string().datetime({ offset: true });
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().nonnegative();
export const ratingSchema = z.number().int().min(1).max(5);
export const percentSchema = z.number().min(0).max(100);

export const nonEmptyTextSchema = z.string().trim().min(1);

export const pageNumberSchema = z.number().int().nonnegative();

export type CatalogId = z.infer<typeof catalogIdSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;
export type LocalDate = z.infer<typeof localDateSchema>;
