import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';
import { pwaManifest } from './src/lib/pwa/manifest.ts';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: './src',
			base: '/',
			scope: '/',
			registerType: 'autoUpdate',
			manifest: pwaManifest,
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				navigateFallback: null,
				// Pagina di cortesia offline (src/routes/offline) e Background Sync della outbox (static/sw-outbox.js)
				additionalManifestEntries: [
					{ url: '/offline', revision: String(Date.now()) },
					{ url: '/textures/wood-grain.svg', revision: '2' },
					{ url: '/textures/wood-front.svg', revision: '1' }
				],
				importScripts: ['/sw-outbox.js'],
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'sb-pages',
							networkTimeoutSeconds: 4,
							precacheFallback: { fallbackURL: '/offline' },
							expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }
						}
					}
				]
			},
			devOptions: { enabled: false }
		})
	],
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
		exclude: ['tests/e2e/**', 'node_modules/**'],
		testTimeout: 30_000,
		hookTimeout: 30_000,
		sequence: { concurrent: false }
	}
});
