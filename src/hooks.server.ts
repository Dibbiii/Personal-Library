import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { validateSession } from '$lib/server/auth';
import { createPgRpcClient } from '$lib/server/db';
import { createRepositories } from '$lib/server/repositories';
import { clearSessionCookie, sessionCookieName } from '$lib/server/session-cookie';
import { builtinThemesCss, resolveBuiltinTheme, THEME_COOKIE } from '$lib/themes';

const PUBLIC_PATHS = [
	'/auth/',
	'/manifest.webmanifest',
	'/sw.js',
	'/workbox-',
	'/icons/',
	'/favicon',
	'/offline'
];

const themeCss = builtinThemesCss();

const session: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(sessionCookieName());
	let user = null;

	if (token) {
		try {
			user = await validateSession(token);
			if (!user) clearSessionCookie(event.cookies);
		} catch {
			// Database non raggiungibile: utente non autenticato, ma il cookie resta valido.
		}
	}

	event.locals.user = user;
	event.locals.repos = user ? createRepositories(createPgRpcClient(user.id)) : null;

	return resolve(event);
};

const theme: Handle = async ({ event, resolve }) => {
	const resolved = resolveBuiltinTheme(event.cookies.get(THEME_COOKIE));
	event.locals.themeKey = resolved.id;

	return resolve(event, {
		preload: ({ type, path }) =>
			type !== 'font' ||
			(path.includes('figtree-latin-wght-normal') && path.endsWith('.woff2')) ||
			(path.includes('young-serif-latin-400-normal') && path.endsWith('.woff2')),
		transformPageChunk: ({ html }) =>
			html
				.replace('%sb.theme%', () => resolved.id)
				.replace('%sb.themecolor%', () => resolved.colors.background)
				.replace('%sb.themecss%', () => themeCss)
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isPublic =
		pathname === '/auth' || PUBLIC_PATHS.some((prefix) => pathname.startsWith(prefix));

	if (!event.locals.user && !isPublic) {
		const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + event.url.search)}`;
		redirect(303, `/auth/login${next}`);
	}

	const isAuthPage = pathname === '/auth/login' || pathname === '/auth/register';
	if (event.locals.user && isAuthPage) {
		redirect(303, '/library');
	}

	return resolve(event);
};

export const handle: Handle = sequence(session, theme, authGuard);
