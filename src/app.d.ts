/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

import type { Repositories } from '$lib/server/repositories';

declare global {
	namespace App {
		interface Locals {
			/** Utente della sessione corrente (cookie httpOnly), null se non autenticato. */
			user: { id: string; email: string; displayName: string | null } | null;
			/** Repository sopra il client Postgres dell'utente; null se non autenticato. */
			repos: Repositories | null;
			/** Chiave del tema built-in letta dal cookie sb-theme. */
			themeKey: string;
		}
		interface PageData {
			themeKey: string;
			user: { id: string; email: string | null; displayName: string | null } | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
