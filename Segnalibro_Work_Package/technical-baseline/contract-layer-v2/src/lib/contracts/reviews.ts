import { z } from 'zod';
import {
  isoTimestampSchema,
  nonEmptyTextSchema,
  positiveIntSchema,
  ratingSchema,
  uuidSchema,
} from './primitives';

export const reviewScoreSchema = z.object({
  dimensionKey: z.string().trim().min(1).max(120),
  label: nonEmptyTextSchema,
  score: ratingSchema,
});

export const tagSchema = z.object({
  id: positiveIntSchema,
  slug: z.string().trim().min(1),
  label: nonEmptyTextSchema,
});

export const reviewSchema = z.object({
  id: uuidSchema,
  userBookId: uuidSchema,

  rating: ratingSchema,

  adjectives: z.tuple([
    nonEmptyTextSchema,
    nonEmptyTextSchema,
    nonEmptyTextSchema,
  ]),

  scores: z.array(reviewScoreSchema),
  tags: z.array(tagSchema),

  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const quoteSchema = z.object({
  id: uuidSchema,
  userBookId: uuidSchema,
  body: nonEmptyTextSchema.max(5000),
  page: positiveIntSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const reviewSaveResultSchema = z.object({
  contractVersion: z.literal(1),
  review: reviewSchema,
});

export type ReviewScore = z.infer<typeof reviewScoreSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type ReviewSaveResult = z.infer<typeof reviewSaveResultSchema>;
