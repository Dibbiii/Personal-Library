import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	themeKey: locals.themeKey,
	user: locals.user
		? {
				id: locals.user.id,
				email: locals.user.email,
				displayName: locals.user.displayName
			}
		: null
});
