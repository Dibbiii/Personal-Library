// Repeatable local lab audit. Keep the same options when comparing two builds.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import postgres from 'postgres';
import sharp from 'sharp';

const origin = process.env.PERFORMANCE_ORIGIN ?? 'http://localhost:4173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const label = process.argv[2] ?? 'controlled';
assert.match(label, /^[a-z0-9-]+$/);
const count = Number(process.env.PERFORMANCE_BOOKS ?? 12);
const iterations = Number(process.env.PERFORMANCE_SAMPLES ?? 5);
assert.ok(Number.isInteger(count) && count >= 12 && count <= 5000);
assert.ok(Number.isInteger(iterations) && iterations >= 1 && iterations <= 10);
const routes = (
	process.env.PERFORMANCE_ROUTES ??
	'/library,/profile,/quotes,/genre/classics,/explore,/add/search,/settings,/friends'
).split(',');
assert.ok(routes.every((route) => route.startsWith('/') && !route.startsWith('//')));
const sql = postgres(
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro',
	{ max: 1, onnotice: () => {} }
);
const browser = await chromium.launch();
browser.on('disconnected', () => console.log('Audit browser closed'));
const email = `controlled-${randomUUID()}@test.local`;
const directory = '.tempo/performance';
const samples = [];
const interactive = process.env.PERFORMANCE_INTERACTIONS === '1';
const flows = [];
let coverMeasurement;
let userId;

function ownedCoverPath(relativePath) {
	assert.ok(userId);
	const root = path.resolve(process.env.STORAGE_DIR ?? './storage', 'covers', userId);
	const target = path.resolve(process.env.STORAGE_DIR ?? './storage', relativePath);
	assert.ok(target === root || target.startsWith(`${root}${path.sep}`));
	return target;
}

function observeVitals() {
	const metrics = {
		lcp: null,
		cls: 0,
		shifts: [],
		worstEvent: null,
		longTasks: 0,
		blockingMs: 0,
		interactions: new Map()
	};
	let sessionStart = 0,
		lastShift = 0,
		sessionScore = 0;
	new PerformanceObserver((list) => {
		for (const e of list.getEntries())
			metrics.lcp = {
				ms: e.startTime,
				tag: e.element?.tagName,
				text: e.element?.textContent?.slice(0, 100),
				url: e.url,
				size: e.size
			};
	}).observe({ type: 'largest-contentful-paint', buffered: true });
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			if (e.hadRecentInput) continue;
			if (metrics.shifts.length < 12)
				metrics.shifts.push({
					value: e.value,
					at: e.startTime,
					sources: e.sources.map((source) => ({
						node: `${source.node?.tagName ?? ''}#${source.node?.id ?? ''}.${String(source.node?.className ?? '')}`,
						previous: source.previousRect.toJSON(),
						current: source.currentRect.toJSON()
					}))
				});
			if (e.startTime - lastShift > 1000 || e.startTime - sessionStart > 5000) {
				sessionStart = e.startTime;
				sessionScore = 0;
			}
			lastShift = e.startTime;
			sessionScore += e.value;
			metrics.cls = Math.max(metrics.cls, sessionScore);
		}
	}).observe({ type: 'layout-shift', buffered: true });
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			metrics.longTasks++;
			metrics.blockingMs += Math.max(0, e.duration - 50);
		}
	}).observe({ type: 'longtask', buffered: true });
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			if (e.interactionId && (!metrics.worstEvent || e.duration > metrics.worstEvent.duration))
				metrics.worstEvent = {
					duration: e.duration,
					type: e.name,
					target: e.target?.getAttribute('aria-label') ?? e.target?.tagName,
					inputDelay: e.processingStart - e.startTime,
					processingMs: e.processingEnd - e.processingStart,
					presentationMs: e.startTime + e.duration - e.processingEnd
				};
			if (e.interactionId)
				metrics.interactions.set(
					e.interactionId,
					Math.max(metrics.interactions.get(e.interactionId) ?? 0, e.duration)
				);
		}
	}).observe({ type: 'event', buffered: true, durationThreshold: 16 });
	window.__controlledMetrics = () => {
		const values = [...metrics.interactions.values()].sort((a, b) => b - a);
		const interactions = performance.interactionCount ?? values.length;
		return {
			lcp: metrics.lcp,
			cls: metrics.cls,
			shifts: metrics.shifts,
			worstEvent: metrics.worstEvent,
			longTasks: metrics.longTasks,
			blockingMs: metrics.blockingMs,
			interactions,
			inpCandidateMs: values.length
				? values[Math.min(values.length - 1, Math.floor(interactions / 50))]
				: null
		};
	};
}

try {
	await mkdir(directory, { recursive: true });
	const setup = await browser.newContext({ baseURL: origin, serviceWorkers: 'block' });
	setup.setDefaultTimeout(30000);
	const page = await setup.newPage();
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.locator('input[name=displayName]').fill('Prova prestazioni');
	await page.locator('input[name=email]').fill(email);
	await page.locator('input[name=password]').fill('Prestazioni-test-2026!');
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');
	const state = await setup.storageState();
	const [user] = await sql`select id from app.users where email=${email}`;
	userId = user.id;
	await sql`insert into public.user_books(user_id,genre_id,title,author_display,page_count,language,format,source,completed_readings_count,lifecycle_state)
		select ${userId}::uuid,1,'Libro '||n,'Autore '||n,200,'it','physical','manual',
		case when ${count}>12 and n%2=0 then 1 else 0 end,case when ${count}>12 and n%2=0 then 'finished' else 'unread' end
		from generate_series(1,${count}) n`;
	const [book] =
		await sql`select id from public.user_books where user_id=${userId}::uuid and title='Libro 1'`;
	const [{ total: searchMatches }] =
		await sql`select count(*)::int as total from public.user_books where user_id=${userId}::uuid and title like 'Libro 1%'`;
	if (routes.includes('/book/fixture')) {
		const started = await page.request.post('/api/reading/start', { data: { bookId: book.id } });
		assert.equal(started.status(), 200, await started.text());
	}
	if (count > 12) {
		await sql`insert into public.quotes(user_id,user_book_id,body) select ${userId}::uuid,${book.id}::uuid,'Citazione '||n from generate_series(1,601)n`;
		// A photographic-style, detailed fixture rather than a tiny single-colour PNG.
		const pixels = Buffer.alloc(1200 * 1800 * 3);
		for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 17 + (i >> 8) * 31) % 256;
		const synthetic = await sharp(pixels, { raw: { width: 1200, height: 1800, channels: 3 } })
			.jpeg({ quality: 92 })
			.toBuffer();
		const image = process.env.PERFORMANCE_COVER
			? await readFile(process.env.PERFORMANCE_COVER)
			: synthetic;
		const started = performance.now();
		const response = await page.request.post('/api/covers/upload', {
			headers: { Origin: new URL(origin).origin },
			multipart: {
				bookId: book.id,
				file: { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: image }
			},
			maxRetries: 1
		});
		assert.equal(response.status(), 200, await response.text());
		const cover = await response.json();
		assert.ok(cover.coverStoragePath, 'Upload response must contain a storage path');
		const original = ownedCoverPath(cover.coverStoragePath);
		const sizes = await Promise.all(
			[128, 320, 768].map(async (width) => ({
				width,
				bytes: (await readFile(`${original}.variants/${width}.webp`)).length
			}))
		);
		coverMeasurement = {
			uploadMs: performance.now() - started,
			originalBytes: image.length,
			variants: sizes
		};
		await rm(ownedCoverPath(`${cover.coverStoragePath}.variants`), {
			recursive: true,
			force: true
		});
		const legacyStart = performance.now();
		const legacy = await page.request.get(`/api/covers/${cover.coverStoragePath}?w=320`);
		assert.equal(legacy.status(), 200);
		coverMeasurement.legacyGenerationMs = performance.now() - legacyStart;
		coverMeasurement.legacyBytes = (await legacy.body()).length;
		await sql`update public.user_books set cover_storage_path=${cover.coverStoragePath} where user_id=${userId}::uuid`;
	}
	await setup.close();
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 800 }
	]) {
		for (const route of routes) {
			for (let iteration = 0; iteration < iterations; iteration++) {
				const context = await browser.newContext({
					baseURL: origin,
					viewport,
					storageState: state,
					serviceWorkers: 'block'
				});
				const tab = await context.newPage();
				context.setDefaultTimeout(30000);
				await tab.addInitScript(observeVitals);
				const cdp = await context.newCDPSession(tab);
				await cdp.send('Network.enable');
				await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
				await cdp.send('Network.emulateNetworkConditions', {
					offline: false,
					latency: 40,
					downloadThroughput: 200000,
					uploadThroughput: 100000,
					connectionType: 'cellular4g'
				});
				const errors = [];
				let catalogRequests = 0;
				if (interactive && route === '/add/search') {
					await tab.route('**/api/catalog/search**', async (request) => {
						catalogRequests++;
						await request.fulfill({
							json: {
								contractVersion: 1,
								candidates: [],
								degraded: false,
								providers: { 'open-library': 'ok', 'google-books': 'ok' }
							}
						});
					});
				}
				tab.on('pageerror', (e) => errors.push(e.message));
				for (const cache of ['cold', 'warm']) {
					const response = await tab.goto(route === '/book/fixture' ? `/book/${book.id}` : route, {
						timeout: 60000
					});
					assert.equal(response.status(), 200);
					await tab.waitForLoadState('networkidle');
					await tab.evaluate(() => document.fonts.ready);
					await tab.evaluate(
						() =>
							new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
					);
					const measurement = await tab.evaluate(() => {
						const nav = performance.getEntriesByType('navigation')[0];
						const resources = performance.getEntriesByType('resource');
						return {
							...window.__controlledMetrics(),
							ttfb: nav.responseStart - nav.requestStart,
							htmlBytes: nav.decodedBodySize,
							jsBytes: resources
								.filter((x) => /\.js(?:\?|$)/.test(x.name))
								.reduce((n, x) => n + x.decodedBodySize, 0),
							transferBytes: nav.transferSize + resources.reduce((n, x) => n + x.transferSize, 0),
							resources: resources.length,
							nodes: document.querySelectorAll('*').length,
							fonts: resources
								.filter((x) => /woff2/.test(x.name))
								.map((x) => ({
									url: x.name,
									start: x.startTime,
									end: x.responseEnd,
									bytes: x.decodedBodySize
								})),
							fontFaces: [...document.fonts]
								.filter((x) => x.status === 'loaded')
								.map((x) => ({ family: x.family, range: x.unicodeRange }))
						};
					});
					assert.ok(measurement.lcp?.ms > 0);
					assert.deepEqual(errors, []);
					samples.push({ route, viewport: viewport.width, iteration, cache, ...measurement });
					console.log(`${viewport.width} ${route} ${iteration} ${cache}: loaded`);
					if (interactive) {
						const started = performance.now();
						let steps = 0;
						if (route === '/library') {
							await tab
								.getByRole('searchbox', { name: 'Cerca nella libreria' })
								.pressSequentially('Libro 1', { delay: 35 });
							await tab
								.getByRole('status')
								.filter({ hasText: `${searchMatches} libri trovati` })
								.waitFor({ timeout: 60000 });
							await tab.waitForLoadState('networkidle');
							await tab.getByRole('button', { name: 'Cancella la ricerca' }).click();
							await tab.getByRole('button', { name: 'Vista elenco' }).click();
							await tab.getByRole('button', { name: 'Vista scaffali' }).click();
							steps = 4;
						} else if (route === '/profile') {
							for (const name of ['Statistiche', 'Calendario', 'Panoramica']) {
								await tab
									.getByRole('navigation', { name: 'Sezioni del profilo' })
									.getByRole('link', { name, exact: true })
									.click();
								await tab.waitForLoadState('networkidle');
							}
							steps = 3;
						} else if (route === '/genre/classics') {
							await tab
								.getByRole('group', { name: 'Ordina i libri da leggere' })
								.getByRole('button', { name: 'Pagine', exact: true })
								.click();
							await tab.waitForLoadState('networkidle');
							steps = 1;
						} else if (route === '/quotes' && count > 12) {
							await tab
								.getByRole('navigation', { name: 'Pagine delle citazioni' })
								.getByRole('link', { name: 'Successiva' })
								.click();
							await tab.waitForLoadState('networkidle');
							steps = 1;
						} else if (route === '/settings') {
							await tab.getByLabel('Ridotto').check();
							await tab.getByLabel('Solo dorsi').check();
							await tab.getByLabel('Segui il dispositivo').check();
							await tab.getByLabel('Misto').check();
							await tab.waitForLoadState('networkidle');
							steps = 4;
						} else if (route === '/add/search') {
							const prior = catalogRequests;
							const field = tab.getByRole('searchbox', { name: 'Titolo, autore, editore o ISBN' });
							await field.pressSequentially('Libro di prova', { delay: 35 });
							const result = tab.waitForResponse('**/api/catalog/search**');
							await field.press('Enter');
							await result;
							await tab.waitForLoadState('networkidle');
							assert.ok(catalogRequests > prior);
							steps = 2;
						} else if (route === '/book/fixture') {
							await tab.getByTestId('update-page').click();
							const dialog = tab.getByRole('dialog', { name: 'Libro 1', exact: true });
							const [reading] =
								await sql`select current_page from public.readings where user_book_id=${book.id}::uuid and status='active'`;
							const next = Number(reading.current_page) + 1;
							await dialog.getByLabel('Pagina raggiunta').fill(String(next));
							await dialog.getByRole('button', { name: 'Salva pagina' }).click();
							await tab
								.getByTestId('notice')
								.filter({ hasText: `Pagina aggiornata a ${next}` })
								.waitFor();
							await tab.waitForLoadState('networkidle');
							steps = 3;
						}
						if (steps) {
							await tab.waitForTimeout(250); // Allow Event Timing's presentation and observer delivery.
							flows.push({
								route,
								viewport: viewport.width,
								cache,
								iteration,
								steps,
								catalogRequests: route === '/add/search' ? catalogRequests : undefined,
								elapsedMs: performance.now() - started,
								...(await tab.evaluate(() => window.__controlledMetrics()))
							});
						}
						assert.deepEqual(errors, []);
					}
				}
				await context.close();
			}
			console.log(`${viewport.width} ${route}`);
		}
	}
	await writeFile(
		`${directory}/${label}.json`,
		JSON.stringify(
			{
				conditions: {
					browser: browser.version(),
					cpuRate: 4,
					latencyMs: 40,
					downloadBytesPerSecond: 200000,
					uploadBytesPerSecond: 100000,
					serviceWorkers: 'block',
					catalogSearch: interactive
						? 'mocked empty response; excludes provider latency'
						: undefined,
					books: count,
					quotes: count > 12 ? 601 : 0,
					iterations,
					routes
				},
				samples,
				flows,
				coverMeasurement
			},
			null,
			2
		)
	);
	console.log(`${samples.length} visits: ${directory}/${label}.json`);
} finally {
	await browser.close();
	await sql`delete from app.users where email=${email}`;
	if (userId)
		await rm(ownedCoverPath(path.join('covers', userId)), {
			recursive: true,
			force: true
		});
	await sql.end();
}
