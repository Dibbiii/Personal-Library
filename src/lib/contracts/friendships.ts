import { z } from 'zod';
import { contractVersionSchema, isoTimestampSchema, uuidSchema } from './primitives';

export const FRIEND_LIBRARY_VISIBILITIES = ['private', 'friends'] as const;

export const friendLibraryVisibilitySchema = z.enum(FRIEND_LIBRARY_VISIBILITIES);

export const friendSchema = z.object({
	userId: uuidSchema,
	displayName: z.string().nullable(),
	createdAt: isoTimestampSchema,
	libraryVisibility: friendLibraryVisibilitySchema
});

export const friendshipsResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	visibility: friendLibraryVisibilitySchema,
	friendships: z.array(friendSchema)
});

/** The raw token is returned once, while only its SHA-256 hash is stored by PostgreSQL. */
export const friendInviteSchema = z.object({
	id: uuidSchema,
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	expiresAt: isoTimestampSchema
});

export const createFriendInviteResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	invite: friendInviteSchema
});

export const redeemFriendInviteInputSchema = z.object({
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Codice invito non valido')
});

export const redeemFriendInviteResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	friendship: friendSchema
});

export const deleteFriendshipInputSchema = z.object({
	friendId: uuidSchema
});

export const setFriendLibraryVisibilityInputSchema = z.object({
	visibility: friendLibraryVisibilitySchema
});

export const friendPrivacySchema = z.object({
	contractVersion: contractVersionSchema,
	library: friendLibraryVisibilitySchema,
	reviews: friendLibraryVisibilitySchema,
	stats: friendLibraryVisibilitySchema,
	quotes: friendLibraryVisibilitySchema,
	activity: friendLibraryVisibilitySchema
});

export const friendProfileSchema = z.object({
	contractVersion: contractVersionSchema,
	userId: uuidSchema,
	displayName: z.string().nullable(),
	privacy: friendPrivacySchema.omit({ contractVersion: true }),
	library: z.array(z.object({
		id: uuidSchema,
		title: z.string(),
		author: z.string(),
		format: z.string(),
		lifecycleState: z.string(),
		rating: z.number().nullable()
	})).nullable(),
	reviews: z.array(z.object({
		bookId: uuidSchema,
		rating: z.number(),
		adjectives: z.array(z.string())
	})).nullable(),
	stats: z.object({ booksFinished: z.number(), dnf: z.number() }).nullable(),
	quotes: z.array(z.object({ id: uuidSchema, body: z.string(), page: z.number().nullable() })).nullable(),
	activity: z.array(z.object({ bookId: uuidSchema, title: z.string(), at: isoTimestampSchema })).nullable()
});

export const friendLibraryVisibilityResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	friendLibraryVisibility: friendLibraryVisibilitySchema
});

export const friendshipMutationResponseSchema = z.object({
	contractVersion: contractVersionSchema,
	ok: z.literal(true)
});

export type FriendLibraryVisibility = z.infer<typeof friendLibraryVisibilitySchema>;
export type FriendPrivacy = z.infer<typeof friendPrivacySchema>;
export type FriendProfile = z.infer<typeof friendProfileSchema>;
export type Friend = z.infer<typeof friendSchema>;
export type FriendshipsResponse = z.infer<typeof friendshipsResponseSchema>;
export type FriendInvite = z.infer<typeof friendInviteSchema>;
export type CreateFriendInviteResponse = z.infer<typeof createFriendInviteResponseSchema>;
export type RedeemFriendInviteInput = z.infer<typeof redeemFriendInviteInputSchema>;
export type RedeemFriendInviteResponse = z.infer<typeof redeemFriendInviteResponseSchema>;
export type DeleteFriendshipInput = z.infer<typeof deleteFriendshipInputSchema>;
export type SetFriendLibraryVisibilityInput = z.infer<typeof setFriendLibraryVisibilityInputSchema>;
export type FriendLibraryVisibilityResponse = z.infer<typeof friendLibraryVisibilityResponseSchema>;
