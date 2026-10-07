import { describe, expect, it } from 'vitest';
import {
	createFriendInviteResponseSchema,
	friendLibraryVisibilityResponseSchema,
	friendshipsResponseSchema,
	redeemFriendInviteInputSchema,
	redeemFriendInviteResponseSchema
} from '../../src/lib/contracts';

const FRIEND_ID = '11111111-1111-4111-8111-111111111111';
const INVITE_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'a'.repeat(43);
const CREATED_AT = '2026-10-07T12:00:00+00:00';

describe('friendship contracts', () => {
	it('accepts a private-by-default friendship listing', () => {
		expect(
			friendshipsResponseSchema.parse({
				contractVersion: 1,
				visibility: 'private',
				friendships: [
					{
						userId: FRIEND_ID,
						displayName: 'Un’amica',
						createdAt: CREATED_AT,
						libraryVisibility: 'private'
					}
				]
			})
		).toMatchObject({ friendships: [{ userId: FRIEND_ID, libraryVisibility: 'private' }] });
	});

	it('exposes a raw invite token only in the create response', () => {
		expect(
			createFriendInviteResponseSchema.parse({
				contractVersion: 1,
				invite: { id: INVITE_ID, token: TOKEN, expiresAt: CREATED_AT }
			})
		).toMatchObject({ invite: { token: TOKEN } });
	});

	it('requires the URL-safe 256-bit token shape when redeeming', () => {
		expect(redeemFriendInviteInputSchema.safeParse({ token: TOKEN }).success).toBe(true);
		expect(redeemFriendInviteInputSchema.safeParse({ token: 'not-a-token' }).success).toBe(false);
	});

	it('accepts a redemption and visibility mutation response', () => {
		expect(
			redeemFriendInviteResponseSchema.parse({
				contractVersion: 1,
				friendship: {
					userId: FRIEND_ID,
					displayName: null,
					createdAt: CREATED_AT,
					libraryVisibility: 'friends'
				}
			})
		).toMatchObject({ friendship: { userId: FRIEND_ID } });
		expect(
			friendLibraryVisibilityResponseSchema.parse({
				contractVersion: 1,
				friendLibraryVisibility: 'friends'
			})
		).toMatchObject({ friendLibraryVisibility: 'friends' });
	});
});
