import { json, type RequestHandler } from '@sveltejs/kit';
import { friendLibraryVisibilitySchema } from '$lib/contracts/friendships';
import { errorResponse, PRIVATE_NO_STORE, readJsonBody, requireUserId } from '$lib/server/catalog/api';
import { requireRepository } from '$lib/server/repositories';
import { z } from 'zod';

const patchSchema = z.object({
	library: friendLibraryVisibilitySchema.optional(),
	reviews: friendLibraryVisibilitySchema.optional(),
	stats: friendLibraryVisibilitySchema.optional(),
	quotes: friendLibraryVisibilitySchema.optional(),
	activity: friendLibraryVisibilitySchema.optional()
});

export const GET: RequestHandler = async (event) => {
	try {
		requireUserId(event);
		return json(await requireRepository(event.locals.repos, 'friendships').getPrivacy(), {
			headers: PRIVATE_NO_STORE
		});
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		requireUserId(event);
		const parsed = patchSchema.parse(await readJsonBody(event.request));
		return json(await requireRepository(event.locals.repos, 'friendships').setVisibility({
			...(parsed.library ? { library: parsed.library } : {}),
			...(parsed.reviews ? { reviews: parsed.reviews } : {}),
			...(parsed.stats ? { stats: parsed.stats } : {}),
			...(parsed.quotes ? { quotes: parsed.quotes } : {}),
			...(parsed.activity ? { activity: parsed.activity } : {})
		}), {
			headers: PRIVATE_NO_STORE
		});
	} catch (cause) {
		return errorResponse(cause, PRIVATE_NO_STORE);
	}
};
