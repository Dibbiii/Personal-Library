import { redirect } from '@sveltejs/kit';
import { invalidateSession } from '$lib/server/auth';
import { clearSessionCookie, sessionCookieName } from '$lib/server/session-cookie';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(sessionCookieName());
	if (token) await invalidateSession(token);
	clearSessionCookie(cookies);
	redirect(303, '/auth/login');
};
