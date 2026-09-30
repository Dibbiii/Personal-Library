import { defineConfig, devices } from '@playwright/test';

// Default: build di produzione (serve al service worker/PWA). E2E_MODE=dev usa `vite dev`,
// necessario per le pagine /dev/* che esistono solo in sviluppo.
const dev = process.env.E2E_MODE === 'dev';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	webServer: {
		command: dev
			? 'npx vite dev --port 4173 --strictPort'
			: 'npm run build && npm run preview -- --port 4173',
		port: 4173,
		reuseExistingServer: true
	},
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }
	]
});
