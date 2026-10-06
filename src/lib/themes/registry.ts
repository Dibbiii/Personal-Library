import { themeDefinitionSchema, type ThemeDefinition } from '../contracts/themes';
import { segnalibroTheme } from './segnalibro';
import { salviaTheme } from './salvia';

const beigeTheme: ThemeDefinition = {
	...segnalibroTheme,
	id: 'beige',
	name: 'Beige legno',
	colors: {
		...segnalibroTheme.colors,
		background: '#F2E8D5',
		surface: '#E5D5BA',
		surfaceElevated: '#FBF5E9',
		textPrimary: '#392B1D',
		textSecondary: '#66513A',
		textMuted: '#70634F',
		primary: '#765331',
		primaryDeep: '#50371F',
		onPrimary: '#FBF5E9',
		primarySubtle: '#E5D5BA',
		secondary: '#8A6947',
		accent: '#C9A875',
		onAccent: '#392B1D',
		border: '#B7A487',
		divider: '#C3B396',
		icon: '#392B1D',
		iconMuted: '#70634F',
		bingoCard: '#F2E4CD',
		sheetHandle: '#C9B596',
		backgroundShelf: '#EBDDCA'
	}
};

export const THEME_COOKIE = 'sb-theme';
export const DEFAULT_THEME_KEY = segnalibroTheme.id;

/** Temi built-in: la validazione a caricamento evita definizioni incomplete. */
export const builtinThemes: Readonly<Record<string, ThemeDefinition>> = Object.freeze({
	[segnalibroTheme.id]: themeDefinitionSchema.parse(segnalibroTheme),
	[salviaTheme.id]: themeDefinitionSchema.parse(salviaTheme),
	[beigeTheme.id]: themeDefinitionSchema.parse(beigeTheme)
});

export function isBuiltinThemeKey(key: string | null | undefined): key is string {
	return typeof key === 'string' && Object.hasOwn(builtinThemes, key);
}

export function resolveBuiltinTheme(key: string | null | undefined): ThemeDefinition {
	const theme = isBuiltinThemeKey(key) ? builtinThemes[key] : undefined;
	return theme ?? (builtinThemes[DEFAULT_THEME_KEY] as ThemeDefinition);
}
