import { z } from 'zod';

/**
 * Informazioni pubbliche su un libro (Open Library, opzionalmente Google Books): descrizione,
 * temi, voto della community, edizioni e autore. Solo lettura, mai salvate nella libreria.
 */
const linkSchema = z.object({ title: z.string(), url: z.string().url() });

export const bookInfoSchema = z.object({
	workTitle: z.string(),
	workUrl: z.string().url(),
	description: z
		.object({
			text: z.string(),
			/** ISO 639-1 se noto (Open Library e' quasi sempre in inglese). */
			language: z.string().nullable(),
			source: z.enum(['open-library', 'google-books'])
		})
		.nullable(),
	firstSentence: z.string().nullable(),
	firstPublishYear: z.number().int().nullable(),
	subjects: z.array(z.string()),
	people: z.array(z.string()),
	places: z.array(z.string()),
	times: z.array(z.string()),
	rating: z.object({ average: z.number(), count: z.number().int() }).nullable(),
	readers: z
		.object({
			alreadyRead: z.number().int(),
			wantToRead: z.number().int(),
			currentlyReading: z.number().int()
		})
		.nullable(),
	editionCount: z.number().int().nullable(),
	pagesMedian: z.number().int().nullable(),
	editions: z.array(
		z.object({
			title: z.string(),
			publisher: z.string().nullable(),
			year: z.number().int().nullable(),
			language: z.string().nullable(),
			pages: z.number().int().nullable(),
			isbn13: z.string().nullable(),
			coverUrl: z.string().url().nullable(),
			url: z.string().url()
		})
	),
	author: z
		.object({
			name: z.string(),
			bio: z.string().nullable(),
			birthDate: z.string().nullable(),
			deathDate: z.string().nullable(),
			photoUrl: z.string().url().nullable(),
			url: z.string().url()
		})
		.nullable(),
	authorWorks: z.array(
		z.object({
			title: z.string(),
			year: z.number().int().nullable(),
			coverUrl: z.string().url().nullable(),
			rating: z.number().nullable(),
			url: z.string().url()
		})
	),
	links: z.array(linkSchema)
});

export type BookInfo = z.infer<typeof bookInfoSchema>;

export const bookInfoQuerySchema = z.object({
	title: z.string().trim().min(1).max(200),
	author: z.string().trim().max(200),
	language: z.string().trim().min(2).max(16).optional()
});

export const bookInfoResponseSchema = z.object({ info: bookInfoSchema.nullable() });
