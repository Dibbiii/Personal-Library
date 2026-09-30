import type { ThemeDefinition } from '../contracts/themes.ts';
import { segnalibroTheme } from './segnalibro.ts';

/**
 * Tema chiaro e caldo alternativo: carta crema con un verde salvia profondo come colore
 * primario. Le palette dei generi sono quelle del tema Segnalibro (già validate per contrasto).
 */
export const salviaTheme: ThemeDefinition = {
	schemaVersion: 1,
	id: 'salvia',
	name: 'Salvia',

	colors: {
		...segnalibroTheme.colors,

		background: '#F5F2E4',
		surface: '#E4E6CF',
		surfaceElevated: '#FBFAF1',

		textPrimary: '#1F2613',
		textSecondary: '#435032',
		textMuted: '#5E6450',

		primary: '#3B5A2B',
		onPrimary: '#F5F2E4',
		primarySubtle: '#E4E6CF',

		secondary: '#5A4A2C',
		onSecondary: '#FFFFFF',

		accent: '#C5D69B',
		onAccent: '#1F2613',

		border: '#A4AA8B',
		divider: '#81815D',

		shadow: '#111506',
		overlay: '#1F2613',

		success: '#2F6B3D',
		warning: '#8A5A00',
		danger: '#9B2D30',
		info: '#2F5F86',

		primaryDeep: '#2B4320',
		shelfAxis: '#323522',
		infoHover: '#4C7FAE',
		sheetHandle: '#C8CDB0',

		backgroundShelf: '#ECEAD4',
		bingoCard: '#E9EDCF',
		graveyardBg: '#DEDDCB',
		tombTop: '#F1F0E1',
		tombBottom: '#DCDCC4',

		leafDark: '#4D6B3A',
		leafLight: '#8FAA73',
		pot: '#B8734E',
		potRim: '#CC8E69'
	},

	genres: segnalibroTheme.genres
};
