import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createFriendInviteResponseSchema,
	friendLibraryVisibilityResponseSchema,
	friendshipsResponseSchema,
	redeemFriendInviteResponseSchema
} from '../../src/lib/contracts';
import { runDb } from '../helpers/env';
import { expectRpcContract, expectRpcError } from '../helpers/rpc';
import { adminSql, createTestUser, type TestUser } from '../helpers/users';

(runDb ? describe : describe.skip)('friendship RPC contracts', () => {
	let inviter: TestUser;
	let recipient: TestUser;
	let inviteToken: string;

	beforeAll(async () => {
		inviter = await createTestUser('friend-inviter');
		recipient = await createTestUser('friend-recipient');
	});

	afterAll(async () => {
		await recipient?.cleanup();
		await inviter?.cleanup();
	});

	it('creates a hashed, single-use invitation and redeems it into an undirected friendship', async () => {
		const created = await expectRpcContract(
			inviter.rpc,
			'create_friend_invite',
			{},
			createFriendInviteResponseSchema
		);
		inviteToken = created.invite.token;
		const [storedInvite] = await adminSql()<{ token_hash: string }[]>`
			select token_hash from public.friend_invites where id = ${created.invite.id}::uuid
		`;
		expect(storedInvite?.token_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(storedInvite?.token_hash).not.toBe(inviteToken);

		const redeemed = await expectRpcContract(
			recipient.rpc,
			'redeem_friend_invite',
			{ p_token: inviteToken },
			redeemFriendInviteResponseSchema
		);
		expect(redeemed.friendship.userId).toBe(inviter.id);
		expect(redeemed.friendship.libraryVisibility).toBe('private');

		const mine = await expectRpcContract(inviter.rpc, 'get_friendships', {}, friendshipsResponseSchema);
		expect(mine.friendships.map((friend) => friend.userId)).toEqual([recipient.id]);

		const replay = await expectRpcError(recipient.rpc, 'redeem_friend_invite', { p_token: inviteToken });
		expect(replay.dataCode).toBe('NOT_FOUND');
	});

	it('updates the owner visibility and allows either participant to delete the friendship', async () => {
		const visibility = await expectRpcContract(
			inviter.rpc,
			'set_friend_library_visibility',
			{ p_visibility: 'friends' },
			friendLibraryVisibilityResponseSchema
		);
		expect(visibility.friendLibraryVisibility).toBe('friends');

		const friend = await expectRpcContract(recipient.rpc, 'get_friendships', {}, friendshipsResponseSchema);
		expect(friend.friendships).toMatchObject([
			{ userId: inviter.id, libraryVisibility: 'friends' }
		]);

		const removed = await recipient.rpc.rpc('delete_friendship', { p_friend_id: inviter.id });
		expect(removed.error).toBeNull();
		expect(removed.data).toMatchObject({ contractVersion: 1, ok: true });

		const empty = await expectRpcContract(inviter.rpc, 'get_friendships', {}, friendshipsResponseSchema);
		expect(empty.friendships).toEqual([]);
	});
});
