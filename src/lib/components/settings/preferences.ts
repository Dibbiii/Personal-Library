import {
	themeDefinitionSchema,
	type ThemeDefinition,
	type ThemeSelection
} from '$lib/contracts/themes';
import { MOTION_COOKIE, SHELF_COOKIE, type MotionPreference } from '$lib/contracts/settings';
import type { ThemeController } from '$lib/themes/controller.svelte';
import { isBuiltinThemeKey } from '$lib/themes/registry';
import { themeToCssVariables } from '$lib/themes/to-css';

export const CUSTOM_THEME_STORAGE_KEY = 'sb-custom-theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function setCookie(name: string, value: string): void {
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Movimento: 'system' segue prefers-reduced-motion (nessun attributo). */
export function applyMotionPreference(preference: MotionPreference): void {
	const root = document.documentElement;
	if (preference === 'system') root.removeAttribute('data-motion');
	else root.setAttribute('data-motion', preference);
	setCookie(MOTION_COOKIE, preference);
}

/**
 * Memorizza le variabili del tema custom per applicarle prima del primo paint (app.html).
 * Sono solo dati: `{ id, vars }` con nomi `--color-*`/`--genre-*` e valori #RRGGBB.
 */
export function rememberCustomTheme(theme: ThemeDefinition | null): void {
	try {
		if (!theme) {
			localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
			return;
		}
		localStorage.setItem(
			CUSTOM_THEME_STORAGE_KEY,
			JSON.stringify({ id: theme.id, vars: themeToCssVariables(theme) })
		);
	} catch {
		// storage non disponibile: il tema verrà applicato dopo l'idratazione
	}
}

/**
 * Toglie le variabili colore inline di un tema custom applicato prima dell'idratazione
 * (app.html): il controller dei temi tiene traccia solo di quelle che applica lui.
 */
export function clearInlineThemeVars(): void {
	const style = document.documentElement.style;
	for (const name of Array.from(style)) {
		if (name.startsWith('--color-') || name.startsWith('--genre-')) style.removeProperty(name);
	}
}

/** Allinea il controller al tema già presente sul documento (il cookie può riferirsi a un tema custom). */
export function adoptDocumentTheme(controller: ThemeController): void {
	const applied = document.documentElement.dataset.theme;
	if (applied && applied !== controller.key) controller.key = applied;
}

/** Applica una selezione (built-in o custom) al documento, senza reload. */
export function applySelection(
	controller: ThemeController,
	selection: ThemeSelection,
	custom: readonly ThemeDefinition[]
): boolean {
	if (selection.kind === 'builtin') {
		if (!isBuiltinThemeKey(selection.key)) return false;
		clearInlineThemeVars();
		controller.selectBuiltin(selection.key);
		rememberCustomTheme(null);
		return true;
	}

	const definition = custom.find((theme) => theme.id === selection.id);
	if (!definition) return false;
	clearInlineThemeVars();
	controller.applyCustom(definition);
	rememberCustomTheme(definition);
	return true;
}

export async function sendJson<T>(
	url: string,
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	body?: unknown
): Promise<T> {
	const init: RequestInit = { method, headers: { accept: 'application/json' } };
	if (body !== undefined) {
		init.headers = { accept: 'application/json', 'content-type': 'application/json' };
		init.body = JSON.stringify(body);
	}
	const response = await fetch(url, init);
	if (!response.ok) {
		let message = 'Operazione non riuscita. Riprova.';
		try {
			const data = (await response.json()) as { message?: string };
			if (typeof data.message === 'string') message = data.message;
		} catch {
			// corpo non JSON
		}
		throw new Error(message);
	}
	return (await response.json()) as T;
}

interface SettingsPayload {
	settings: {
		displayName: string | null;
		shelfMode: string;
		motionPreference: MotionPreference;
		selection: ThemeSelection;
	};
	customTheme: unknown;
}

const SYNC_FLAG = 'sb-prefs-synced';

/**
 * Riallinea il dispositivo alle preferenze del profilo (tema, movimento) una volta per sessione
 * del browser: il profilo DB resta la sorgente persistente, il cookie è solo la copia per l'SSR.
 */
export async function syncPreferencesFromProfile(controller: ThemeController): Promise<void> {
	try {
		if (sessionStorage.getItem(SYNC_FLAG)) return;
	} catch {
		// sessionStorage non disponibile: sincronizza comunque
	}
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

	try {
		const payload = await sendJson<SettingsPayload>('/api/settings', 'GET');
		applyMotionPreference(payload.settings.motionPreference);
		setCookie(SHELF_COOKIE, payload.settings.shelfMode);

		const { selection } = payload.settings;
		if (selection.kind === 'builtin') {
			if (controller.key !== selection.key || document.documentElement.style.length > 0) {
				applySelection(controller, selection, []);
			}
		} else {
			const parsed = themeDefinitionSchema.safeParse(payload.customTheme);
			if (parsed.success) applySelection(controller, selection, [parsed.data]);
		}
		try {
			sessionStorage.setItem(SYNC_FLAG, '1');
		} catch {
			// ignora
		}
	} catch {
		// offline o errore: riproverà alla prossima apertura
	}
}
