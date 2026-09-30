import type { ThemeDefinition } from '../contracts/themes';

/**
 * Genera le CSS variables da una ThemeDefinition validata.
 * Può essere usato build-time per i temi built-in e runtime per un tema custom.
 */
export function themeToCssVariables(theme: ThemeDefinition): Record<string, string> {
	const vars: Record<string, string> = {};

	for (const [key, value] of Object.entries(theme.colors)) {
		vars[`--color-${camelToKebab(key)}`] = value;
	}

	for (const [slug, palette] of Object.entries(theme.genres)) {
		vars[`--genre-${slug}`] = palette.base;
		vars[`--genre-${slug}-light`] = palette.light;
		vars[`--genre-${slug}-dark`] = palette.dark;
		vars[`--genre-${slug}-on-base`] = palette.onBase;
		vars[`--genre-${slug}-on-light`] = palette.onLight;
	}

	return vars;
}

export function applyThemeToElement(element: HTMLElement, theme: ThemeDefinition): void {
	const vars = themeToCssVariables(theme);

	for (const [name, value] of Object.entries(vars)) {
		element.style.setProperty(name, value);
	}

	element.dataset.theme = theme.id;
}

function camelToKebab(value: string): string {
	return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
