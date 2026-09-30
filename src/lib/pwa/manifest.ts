import type { ManifestOptions } from 'vite-plugin-pwa';
import { segnalibroTheme } from '../themes/segnalibro.ts';

const { colors } = segnalibroTheme;

export const pwaManifest: Partial<ManifestOptions> = {
	name: 'Segnalibro',
	short_name: 'Segnalibro',
	description: 'La tua libreria personale e diario di lettura.',
	lang: 'it',
	start_url: '/library',
	scope: '/',
	display: 'standalone',
	orientation: 'portrait',
	theme_color: colors.background,
	background_color: colors.background,
	categories: ['books', 'lifestyle'],
	icons: [
		{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
		{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
		{
			src: '/icons/icon-maskable-512.png',
			sizes: '512x512',
			type: 'image/png',
			purpose: 'maskable'
		}
	]
};
