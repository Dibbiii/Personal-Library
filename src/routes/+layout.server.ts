import type { LayoutServerLoad } from './$types';
import { serverEnv } from '$lib/server/db/env';

export const load: LayoutServerLoad = ({ locals, depends }) => {
	depends('app:user');
	return {
		themeKey: locals.themeKey,
		catalogSbnEnabled: Boolean(serverEnv('SBN_BRIDGE_URL')),
		user: locals.user
			? {
					id: locals.user.id,
					email: locals.user.email,
					displayName: locals.user.displayName
				}
			: null
	};
};
