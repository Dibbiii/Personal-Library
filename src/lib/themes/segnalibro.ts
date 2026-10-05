import type { ThemeDefinition } from '../contracts/themes.ts';

/**
 * UNICO posto (insieme agli altri file theme) in cui sono ammessi colori
 * letterali dell'interfaccia.
 *
 * I componenti devono usare solo CSS variables semantiche.
 */
export const segnalibroTheme: ThemeDefinition = {
	schemaVersion: 1,
	id: 'segnalibro',
	name: 'Segnalibro',

	colors: {
		background: '#FAF1EE',
		surface: '#F2DCDB',
		surfaceElevated: '#FDF7F5',

		textPrimary: '#340A0E',
		textSecondary: '#6B3A42',
		textMuted: '#6F625F',

		primary: '#6C0820',
		onPrimary: '#FAF1EE',
		primarySubtle: '#F2DCDB',

		secondary: '#6F2B34',
		onSecondary: '#FFFFFF',

		accent: '#F2AEBC',
		onAccent: '#340A0E',

		border: '#B79F9D',
		divider: '#81815D',

		icon: '#111506',
		iconMuted: '#81815D',

		shadow: '#111506',
		overlay: '#340A0E',

		success: '#476C4F',
		onSuccess: '#FFFFFF',

		warning: '#9A6500',
		onWarning: '#FFFFFF',

		danger: '#9B2D30',
		onDanger: '#FFFFFF',

		info: '#3D5D91',
		onInfo: '#FFFFFF',

		// Colori del mockup senza token nella spec (docs/mockup/DESIGN_REFERENCE.md, 2.3)
		primaryDeep: '#570F1D',
		shelfAxis: '#323522',
		infoHover: '#5A86CB',
		onGenreInk: '#23100A',
		onGenreWhite: '#FFFFFF',
		sheetHandle: '#DDBFBB',

		backgroundShelf: '#F6E6E2',
		bingoCard: '#FBE5EA',
		graveyardBg: '#E2DBD1',
		tombTop: '#F6EAE7',
		tombBottom: '#E6D2CF',

		woodInk: '#3B2615',
		woodTop: '#D6B583',
		woodMid: '#C79A64',
		woodBottom: '#AE7C48',
		woodDetailTop: '#F4E1B7',
		woodDetailMid: '#E2C394',
		woodDetailBottom: '#BC9161',

		waxEdge: '#C9A08A',
		flame: '#E8843A',
		flameCore: '#FBE3CC',
		leafDark: '#656648',
		leafLight: '#949475',
		pot: '#C4694A',
		potRim: '#D98565'
	},

	genres: {
		classics: {
			base: '#8B5E3C',
			light: '#EADCCB',
			dark: '#4A2E1A',
			onBase: '#FFFFFF',
			onLight: '#340A0E'
		},

		'mythology-epic-retelling': {
			base: '#C4694A',
			light: '#F5DDD2',
			dark: '#6B301D',
			onBase: '#340A0E',
			onLight: '#340A0E'
		},

		'dystopia-scifi': {
			base: '#E8843A',
			light: '#FBE3CC',
			dark: '#7A3E0E',
			onBase: '#340A0E',
			onLight: '#340A0E'
		},

		'thriller-mystery': {
			base: '#E0B62B',
			light: '#FAF0C4',
			dark: '#6B5410',
			onBase: '#340A0E',
			onLight: '#340A0E'
		},

		'fantasy-magical-gothic': {
			base: '#7E5BA8',
			light: '#E6DCF0',
			dark: '#3F2A5C',
			onBase: '#FFFFFF',
			onLight: '#340A0E'
		},

		'romance-ya-na': {
			base: '#E0708F',
			light: '#FADCE4',
			dark: '#7A2444',
			onBase: '#340A0E',
			onLight: '#340A0E'
		},

		'contemporary-historical': {
			base: '#6FB0DC',
			light: '#DCEEF8',
			dark: '#23506E',
			onBase: '#340A0E',
			onLight: '#340A0E'
		}
	}
};
