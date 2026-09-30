import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { authenticate, createSession } from '$lib/server/auth';
import { safeRedirectPath } from '$lib/server/auth-forms';
import { setSessionCookie } from '$lib/server/session-cookie';
import type { Actions } from './$types';

const loginSchema = z.object({
	email: z.string().trim().email('Inserisci un indirizzo email valido.'),
	password: z.string().min(1, 'Inserisci la password.')
});

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const parsed = loginSchema.safeParse({ email, password: form.get('password') ?? '' });

		if (!parsed.success) {
			const errors = z.flattenError(parsed.error).fieldErrors;
			return fail(400, {
				email,
				message: null,
				fieldErrors: { email: errors.email?.[0] ?? null, password: errors.password?.[0] ?? null }
			});
		}

		let session;
		try {
			const user = await authenticate(parsed.data.email, parsed.data.password);
			if (!user) {
				return fail(400, { email, message: 'Email o password non corrette.', fieldErrors: null });
			}
			session = await createSession(user.id);
		} catch {
			return fail(503, {
				email,
				message: 'Servizio non raggiungibile. Riprova tra un momento.',
				fieldErrors: null
			});
		}

		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, safeRedirectPath(url.searchParams.get('next')));
	}
};
