import { json, type RequestHandler } from '@sveltejs/kit';
import {
	friendLibraryVisibilitySchema,
	redeemFriendInviteInputSchema
} from '$lib/contracts/friendships';
import { requireRepository } from '$lib/server/repositories';
import { errorResponse, PRIVATE_NO_STORE, readJsonBody, requireUserId } from '$lib/server/catalog/api';
import { z } from 'zod';

export const GET: RequestHandler = async (event) => {
	try {
		requireUserId(event);
		const friends = requireRepository(event.locals.repos, 'friendships');
		return json(await friends.getAll(), { headers: PRIVATE_NO_STORE });
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		requireUserId(event);
		const friends = requireRepository(event.locals.repos, 'friendships');
		const body = await readJsonBody(event.request);
		const action = z.object({ action: z.enum(['create', 'redeem', 'visibility']), token: z.string().optional(), visibility: friendLibraryVisibilitySchema.optional() }).parse(body);
		if (action.action === 'create') return json(await friends.createInvite(), { headers: PRIVATE_NO_STORE });
		if (action.action === 'redeem') {
			const input = redeemFriendInviteInputSchema.parse({ token: action.token });
			return json(await friends.redeemInvite(input), { headers: PRIVATE_NO_STORE });
		}
		const visibility = friendLibraryVisibilitySchema.parse(action.visibility);
		return json(await friends.setLibraryVisibility({ visibility }), { headers: PRIVATE_NO_STORE });
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};