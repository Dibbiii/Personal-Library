import { themeDefinitionSchema, type ThemeDefinition } from '../contracts/themes';
import { segnalibroTheme } from './segnalibro';
import { salviaTheme } from './salvia';

export const THEME_COOKIE = 'sb-theme';
export const DEFAULT_THEME_KEY = segnalibroTheme.id;

/** Temi built-in: la validazione a caricamento evita definizioni incomplete. */
export const builtinThemes: Readonly<Record<string, ThemeDefinition>> = Object.freeze({
	[segnalibroTheme.id]: themeDefinitionSchema.parse(segnalibroTheme),
	[salviaTheme.id]: themeDefinitionSchema.parse(salviaTheme)
});

export function isBuiltinThemeKey(key: string | null | undefined): key is string {
	return typeof key === 'string' && Object.hasOwn(builtinThemes, key);
}

export function resolveBuiltinTheme(key: string | null | undefined): ThemeDefinition {
	const theme = isBuiltinThemeKey(key) ? builtinThemes[key] : undefined;
	return theme ?? (builtinThemes[DEFAULT_THEME_KEY] as ThemeDefinition);
}
