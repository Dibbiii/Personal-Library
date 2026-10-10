// Run against a local production server. Creates and removes its own fixture user.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import postgres from 'postgres';

const origin = process.env.PERFORMANCE_ORIGIN ?? 'http://localhost:4173';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
	throw new Error('Performance fixtures are restricted to a local server');
}
const sql = postgres(
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro',
	{ max: 1, onnotice: () => {} }
);
const browser = await chromium.launch();
const email = `performance-${randomUUID()}@test.local`;
const routes = [
	'/library',
	'/profile',
	'/quotes',
	'/explore',
	'/add/search',
	'/settings',
	'/friends',
	'/genre/classics'
];
const samples = [];
try {
	const setup = await browser.newContext({ baseURL: origin, serviceWorkers: 'block' });
	const page = await setup.newPage();
	await page.goto('/auth/register');
	await page.locator('input[name=displayName]').fill('Prova prestazioni');
	await page.locator('input[name=email]').fill(email);
	await page.locator('input[name=password]').fill('Prestazioni-test-2026!');
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');
	const state = await setup.storageState();
	const [user] = await sql`select id from app.users where email=${email}`;
	await sql`insert into public.user_books (user_id,genre_id,title,author_display,page_count,language,format,source)
		select ${user.id}::uuid,1,'Libro '||n,'Autore '||n,200,'it','physical','manual' from generate_series(1,12) n`;
	await setup.close();
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 800 }
	]) {
		for (const serviceWorkers of ['block', 'allow']) {
			for (const route of routes) {
				for (let iteration = 0; iteration < 5; iteration++) {
					const context = await browser.newContext({
						baseURL: origin,
						viewport,
						storageState: state,
						serviceWorkers
					});
					const tab = await context.newPage();
					await tab.addInitScript(() => {
						window.__auditLcp = 0;
						new PerformanceObserver((list) => {
							for (const entry of list.getEntries()) window.__auditLcp = entry.startTime;
						}).observe({ type: 'largest-contentful-paint', buffered: true });
					});
					for (const cache of ['cold', 'warm']) {
						const response = await tab.goto(route);
						if (response.status() !== 200) throw new Error(`${route}: ${response.status()}`);
						await tab.waitForLoadState('networkidle');
						if (serviceWorkers === 'allow') await tab.evaluate(() => navigator.serviceWorker.ready);
						const measurement = await tab.evaluate(() => {
							const nav = performance.getEntriesByType('navigation')[0];
							const resources = performance.getEntriesByType('resource');
							return {
								ttfb: nav.responseStart - nav.requestStart,
								lcp: window.__auditLcp,
								htmlBytes: nav.decodedBodySize,
								transferBytes: nav.transferSize + resources.reduce((n, r) => n + r.transferSize, 0),
								jsBytes: resources
									.filter((r) => /\.js(?:\?|$)/.test(r.name))
									.reduce((n, r) => n + r.decodedBodySize, 0),
								requests: resources.length,
								nodes: document.querySelectorAll('*').length
							};
						});
						samples.push({
							route,
							viewport: viewport.width,
							serviceWorkers,
							cache,
							iteration,
							...measurement
						});
					}
					await context.close();
				}
				console.log(`${viewport.width} ${serviceWorkers} ${route}`);
			}
		}
	}
	await mkdir('.tempo/performance', { recursive: true });
	const file = `.tempo/performance/${process.argv[2] ?? 'audit'}.json`;
	await writeFile(
		file,
		JSON.stringify(
			{
				conditions:
					'Production build; unthrottled local Chromium; 12 books; 5 samples per combination; LCP observed through networkidle',
				samples
			},
			null,
			2
		)
	);
	console.log(file);
} finally {
	await browser.close();
	await sql`delete from app.users where email=${email}`;
	await sql.end();
}
