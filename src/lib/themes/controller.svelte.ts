import { getContext, setContext } from 'svelte';
import { themeDefinitionSchema, type ThemeDefinition } from '../contracts/themes';
import { isBuiltinThemeKey, THEME_COOKIE } from './registry';
import { themeToCssVariables } from './to-css';

const CONTEXT_KEY = Symbol('segnalibro-theme');
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Stato del tema attivo nel browser. I temi built-in sono già nel CSS dell'head
 * (selezionati da data-theme); quelli custom vengono applicati come variabili inline.
 */
export class ThemeController {
	key = $state('');
	#inlineVars: string[] = [];

	constructor(initialKey: string) {
		this.key = initialKey;
	}

	selectBuiltin(key: string) {
		if (!isBuiltinThemeKey(key)) throw new Error(`Tema sconosciuto: ${key}`);
		this.#clearInline();
		this.#commit(key);
	}

	/** Applica un tema custom già salvato: il JSON viene rivalidato, mai CSS arbitrario. */
	applyCustom(theme: ThemeDefinition) {
		const valid = themeDefinitionSchema.parse(theme);
		this.#clearInline();

		const root = document.documentElement;
		for (const [name, value] of Object.entries(themeToCssVariables(valid))) {
			root.style.setProperty(name, value);
			this.#inlineVars.push(name);
		}
		this.#commit(valid.id);
	}

	#clearInline() {
		const root = document.documentElement;
		for (const name of this.#inlineVars) root.style.removeProperty(name);
		this.#inlineVars = [];
	}

	#commit(key: string) {
		this.key = key;
		document.documentElement.dataset.theme = key;
		document.cookie = `${THEME_COOKIE}=${key}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
	}
}

export function setThemeController(controller: ThemeController) {
	setContext(CONTEXT_KEY, controller);
	return controller;
}

export function getThemeController(): ThemeController {
	return getContext<ThemeController>(CONTEXT_KEY);
}
