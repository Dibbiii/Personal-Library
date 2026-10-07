import { z } from 'zod';
import { bookInfoSchema } from './book-info';

export const editionsQuerySchema = z.object({
	workId: z.string().regex(/^OL[0-9]+W$/),
	offset: z.coerce.number().int().min(0).max(10000).default(0)
});
export const editionsResponseSchema = z.object({
	editions: bookInfoSchema.shape.editions,
	total: z.number().int().nonnegative(),
	nextOffset: z.number().int().nonnegative().nullable()
});
export type EditionsPage = z.infer<typeof editionsResponseSchema>;
