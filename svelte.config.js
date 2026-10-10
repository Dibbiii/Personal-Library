import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Le pagine dell'app richiedono una sessione; genera soltanto il fallback pubblico.
		prerender: {
			crawl: false,
			entries: ['/offline']
		}
	}
};

export default config;
