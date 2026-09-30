import { z } from 'zod';
import { genreSlugSchema } from './enums';
import {
	contractVersionSchema,
	isoTimestampSchema,
	nonEmptyTextSchema,
	positiveIntSchema,
	ratingSchema,
	uuidSchema
} from './primitives';

export const reviewScoreSchema = z.object({
	dimensionKey: z.string().trim().min(1).max(120),
	label: nonEmptyTextSchema,
	score: ratingSchema
});

export const tagSchema = z.object({
	id: positiveIntSchema,
	slug: z.string().trim().min(1),
	label: nonEmptyTextSchema
});

export const reviewSchema = z.object({
	id: uuidSchema,
	userBookId: uuidSchema,

	rating: ratingSchema,

	adjectives: z.tuple([nonEmptyTextSchema, nonEmptyTextSchema, nonEmptyTextSchema]),

	scores: z.array(reviewScoreSchema),
	tags: z.array(tagSchema),

	createdAt: isoTimestampSchema,
	updatedAt: isoTimestampSchema
});

export const quoteSchema = z.object({
	id: uuidSchema,
	userBookId: uuidSchema,
	body: nonEmptyTextSchema.max(5000),
	page: positiveIntSchema.nullable(),
	createdAt: isoTimestampSchema,
	updatedAt: isoTimestampSchema
});

export const reviewSaveResultSchema = z.object({
	contractVersion: z.literal(1),
	review: reviewSchema
});

export type ReviewScore = z.infer<typeof reviewScoreSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type ReviewSaveResult = z.infer<typeof reviewSaveResultSchema>;

// ---------------------------------------------------------------------------
// Dati di riferimento della recensione e citazioni (migration 103)
// ---------------------------------------------------------------------------

export const ratingDimensionSchema = z.object({
	dimensionKey: z.string().trim().min(1).max(120),
	genreSlug: genreSlugSchema,
	label: nonEmptyTextSchema,
	sortOrder: positiveIntSchema,
	version: positiveIntSchema
});

export const reviewReferenceResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	tags: z.array(tagSchema),
	dimensions: z.array(ratingDimensionSchema)
});

export const QUOTE_MAX_LENGTH = 5000;

export const quoteBodySchema = z.string().trim().min(1).max(QUOTE_MAX_LENGTH);

export const addQuoteInputSchema = z.object({
	bookId: uuidSchema,
	body: quoteBodySchema,
	page: positiveIntSchema.nullable().default(null)
});

export const updateQuoteInputSchema = z.object({
	quoteId: uuidSchema,
	body: quoteBodySchema,
	page: positiveIntSchema.nullable().default(null)
});

export const quoteMutationResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	quote: quoteSchema
});

export const quoteDeleteResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	ok: z.literal(true)
});

export type RatingDimension = z.infer<typeof ratingDimensionSchema>;
export type ReviewReferenceResponse = z.infer<typeof reviewReferenceResponseSchema>;
export type AddQuoteInput = z.input<typeof addQuoteInputSchema>;
export type UpdateQuoteInput = z.input<typeof updateQuoteInputSchema>;
export type QuoteMutationResponse = z.infer<typeof quoteMutationResponseSchema>;
