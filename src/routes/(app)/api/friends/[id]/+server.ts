import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteFriendshipInputSchema } from '$lib/contracts/friendships';
import { errorResponse, PRIVATE_NO_STORE, requireUserId } from '$lib/server/catalog/api';
import { requireRepository } from '$lib/server/repositories';

export const DELETE: RequestHandler = async (event) => {
	try {
		requireUserId(event);
		const friends = requireRepository(event.locals.repos, 'friendships');
		const { friendId } = deleteFriendshipInputSchema.parse({ friendId: event.params.id });
		await friends.remove({ friendId });
		return json({ ok: true }, { headers: PRIVATE_NO_STORE });
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};