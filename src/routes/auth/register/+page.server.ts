import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	createSession,
	EmailTakenError,
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
	registerUser
} from '$lib/server/auth';
import { setSessionCookie } from '$lib/server/session-cookie';
import type { Actions } from './$types';

const registerSchema = z.object({
	displayName: z.string().trim().min(1, 'Come ti chiami?').max(60, 'Massimo 60 caratteri.'),
	email: z.string().trim().email('Inserisci un indirizzo email valido.'),
	password: z
		.string()
		.min(MIN_PASSWORD_LENGTH, `Usa almeno ${MIN_PASSWORD_LENGTH} caratteri.`)
		.max(MAX_PASSWORD_LENGTH, `Massimo ${MAX_PASSWORD_LENGTH} caratteri.`)
});

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const values = {
			displayName: String(form.get('displayName') ?? ''),
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? '')
		};
		const parsed = registerSchema.safeParse(values);

		if (!parsed.success) {
			const errors = z.flattenError(parsed.error).fieldErrors;
			return fail(400, {
				displayName: values.displayName,
				email: values.email,
				message: null,
				fieldErrors: {
					displayName: errors.displayName?.[0] ?? null,
					email: errors.email?.[0] ?? null,
					password: errors.password?.[0] ?? null
				}
			});
		}

		let session;
		try {
			const user = await registerUser(parsed.data);
			session = await createSession(user.id);
		} catch (error) {
			const taken = error instanceof EmailTakenError;
			return fail(taken ? 400 : 503, {
				displayName: values.displayName,
				email: values.email,
				message: taken
					? 'Esiste già un account con questa email.'
					: 'Servizio non raggiungibile. Riprova tra un momento.',
				fieldErrors: null
			});
		}

		setSessionCookie(cookies, session.token, session.expiresAt);
		redirect(303, '/library');
	}
};
