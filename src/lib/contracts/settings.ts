import { z } from 'zod';
import { contractVersionSchema, uuidSchema } from './primitives';
import { themeDefinitionSchema, themeSelectionSchema } from './themes';

export const SHELF_MODES = ['hybrid', 'spines', 'covers'] as const;
export const MOTION_PREFERENCES = ['system', 'reduce', 'full'] as const;

export const shelfModeSchema = z.enum(SHELF_MODES);
export const motionPreferenceSchema = z.enum(MOTION_PREFERENCES);

export type ShelfMode = z.infer<typeof shelfModeSchema>;
export type MotionPreference = z.infer<typeof motionPreferenceSchema>;

/** Cookie con la copia delle preferenze per SSR e documento iniziale (la sorgente è il profilo DB). */
export const MOTION_COOKIE = 'sb-motion';
export const SHELF_COOKIE = 'sb-shelf';

export const DEFAULT_SHELF_MODE: ShelfMode = 'hybrid';
export const DEFAULT_MOTION_PREFERENCE: MotionPreference = 'system';

export const displayNameSchema = z.string().trim().min(1, 'Scrivi un nome').max(80);

export const userSettingsSchema = z.object({
	contractVersion: contractVersionSchema,
	displayName: z.string().nullable(),
	shelfMode: shelfModeSchema,
	motionPreference: motionPreferenceSchema,
	selection: themeSelectionSchema
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const updateSettingsInputSchema = z
	.object({
		displayName: displayNameSchema.optional(),
		shelfMode: shelfModeSchema.optional(),
		motionPreference: motionPreferenceSchema.optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, 'Nessuna modifica');

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// ---------------------------------------------------------------------------
// Temi custom
// ---------------------------------------------------------------------------

/** Riga restituita dal database: i token (colors + genres) sono rivalidati dal repository. */
export const customThemeRowSchema = z.object({
	id: uuidSchema,
	name: z.string(),
	schemaVersion: z.number().int().positive(),
	tokens: z.unknown()
});

export const customThemeListResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	themes: z.array(customThemeRowSchema)
});

export const customThemeResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	theme: customThemeRowSchema
});

export const okResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	ok: z.literal(true)
});

/** Corpo dell'endpoint di salvataggio: il tema intero, l'id (se c'è) decide tra insert e update. */
export const saveCustomThemeBodySchema = z.object({
	theme: themeDefinitionSchema,
	id: uuidSchema.optional()
});

export const selectThemeBodySchema = themeSelectionSchema;

// ---------------------------------------------------------------------------
// Export dati
// ---------------------------------------------------------------------------

export const exportBookSchema = z.object({
	id: uuidSchema,
	title: z.string(),
	author: z.string(),
	genre: z.string(),
	genreName: z.string(),
	pageCount: z.number().nullable(),
	language: z.string().nullable(),
	isbn10: z.string().nullable(),
	isbn13: z.string().nullable(),
	format: z.string(),
	seriesName: z.string().nullable(),
	seriesNumber: z.union([z.number(), z.string()]).nullable(),
	seriesTotal: z.number().nullable(),
	coverUrl: z.string().nullable(),
	hasCustomCover: z.boolean(),
	source: z.string(),
	lifecycleState: z.string(),
	completedReadingsCount: z.number(),
	rating: z.number().nullable(),
	lastFinishedAt: z.string().nullable(),
	lastActivityAt: z.string().nullable(),
	createdAt: z.string(),
	tags: z.array(z.string())
});

export const userExportSchema = z.object({
	contractVersion: contractVersionSchema,
	format: z.literal('segnalibro-export'),
	exportedAt: z.string(),
	profile: z.record(z.string(), z.unknown()).nullable(),
	preferences: z.record(z.string(), z.unknown()).nullable(),
	customThemes: z.array(z.unknown()),
	books: z.array(exportBookSchema),
	queue: z.array(z.unknown()),
	readings: z.array(z.unknown()),
	progressEvents: z.array(z.unknown()),
	reviews: z.array(z.unknown()),
	quotes: z.array(z.unknown()),
	bingoBoards: z.array(z.unknown())
});

export type UserExport = z.infer<typeof userExportSchema>;
export type ExportBook = z.infer<typeof exportBookSchema>;
