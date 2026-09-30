import { json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	authenticate,
	checkLoginRateLimit,
	clearLoginFailures,
	deleteAccount,
	normalizeEmail,
	recordLoginFailure
} from '$lib/server/auth';
import { clearSessionCookie } from '$lib/server/session-cookie';
import { MOTION_COOKIE, SHELF_COOKIE } from '$lib/contracts/settings';
import { THEME_COOKIE } from '$lib/themes/registry';
import { errorResponse, parseJsonBody, toErrorResponse } from '$lib/server/settings-http';
import type { RequestHandler } from './$types';

const deleteAccountBodySchema = z.object({
	/** L'utente deve riscrivere la propria email... */
	email: z.string().min(1),
	/** ...e la password (riautenticazione prima di un'azione irreversibile). */
	password: z.string().min(1).max(1024)
});

/** Cancellazione definitiva dell'account e di tutti i suoi dati (spec §41). */
export const DELETE: RequestHandler = async (event) => {
	const { user } = event.locals;
	if (!user) return errorResponse('AUTH_REQUIRED');

	try {
		const body = await parseJsonBody(
			event.request,
			deleteAccountBodySchema,
			'Conferma non valida.'
		);
		const ip = event.getClientAddress();

		if (normalizeEmail(body.email) !== normalizeEmail(user.email)) {
			return errorResponse('VALIDATION', 'L’email non corrisponde a quella dell’account.');
		}

		const limit = checkLoginRateLimit(user.email, ip);
		if (!limit.allowed)
			return errorResponse('RATE_LIMITED', 'Troppi tentativi: riprova fra qualche minuto.');

		const verified = await authenticate(user.email, body.password);
		if (!verified || verified.id !== user.id) {
			recordLoginFailure(user.email, ip);
			return errorResponse('VALIDATION', 'Password non corretta.');
		}
		clearLoginFailures(user.email, ip);

		// Elimina utente, libreria, sessioni (cascata) e cover su disco.
		await deleteAccount(user.id);

		clearSessionCookie(event.cookies);
		for (const name of [THEME_COOKIE, MOTION_COOKIE, SHELF_COOKIE]) {
			event.cookies.delete(name, { path: '/' });
		}

		return json(
			{ ok: true, redirect: '/auth/login' },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return toErrorResponse(error);
	}
};
