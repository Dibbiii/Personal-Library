import {
	createFriendInviteResponseSchema,
	friendLibraryVisibilityResponseSchema,
	friendshipMutationResponseSchema,
	friendPrivacySchema,
	friendProfileSchema,
	friendshipsResponseSchema,
	redeemFriendInviteResponseSchema,
	type DeleteFriendshipInput,
	type RedeemFriendInviteInput,
	type SetFriendLibraryVisibilityInput
} from '../contracts/friendships';
import type { FriendshipsRepository } from './repositories';
import { callRpc, type RpcTransport } from './rpc-client';
import { RPC } from './rpc-names';

export class RpcFriendshipsRepository implements FriendshipsRepository {
	constructor(private readonly transport: RpcTransport) {}

	getAll() {
		return callRpc(this.transport, RPC.getFriendships, {}, friendshipsResponseSchema);
	}

	createInvite() {
		return callRpc(this.transport, RPC.createFriendInvite, {}, createFriendInviteResponseSchema);
	}

	redeemInvite(input: RedeemFriendInviteInput) {
		return callRpc(
			this.transport,
			RPC.redeemFriendInvite,
			{ p_token: input.token },
			redeemFriendInviteResponseSchema
		);
	}

	async remove(input: DeleteFriendshipInput): Promise<void> {
		await callRpc(
			this.transport,
			RPC.deleteFriendship,
			{ p_friend_id: input.friendId },
			friendshipMutationResponseSchema
		);
	}

	setLibraryVisibility(input: SetFriendLibraryVisibilityInput) {
		return callRpc(
			this.transport,
			RPC.setFriendLibraryVisibility,
			{ p_visibility: input.visibility },
			friendLibraryVisibilityResponseSchema
		);
	}

	getPrivacy() {
		return callRpc(this.transport, RPC.getFriendPrivacy, {}, friendPrivacySchema);
	}

	setVisibility(input: {
		library?: 'private' | 'friends';
		reviews?: 'private' | 'friends';
		stats?: 'private' | 'friends';
		quotes?: 'private' | 'friends';
		activity?: 'private' | 'friends';
	}) {
		return callRpc(
			this.transport,
			RPC.setFriendVisibility,
			{
				p_library: input.library ?? null,
				p_reviews: input.reviews ?? null,
				p_stats: input.stats ?? null,
				p_quotes: input.quotes ?? null,
				p_activity: input.activity ?? null
			},
			friendPrivacySchema
		);
	}

	getProfile(friendId: string) {
		return callRpc(this.transport, RPC.getFriendProfile, { p_friend_id: friendId }, friendProfileSchema);
	}
}
