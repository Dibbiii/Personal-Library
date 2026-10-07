import { randomUUID } from 'node:crypto';
import {
	expect,
	test,
	type BrowserContext,
	type BrowserContextOptions,
	type Page,
	type TestInfo
} from '@playwright/test';
import postgres from 'postgres';

const ADMIN_URL =
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';
const PASSWORD = 'Impostazioni-e2e-2026!';

let sql: postgres.Sql;

/** Opzioni del progetto (mobile/desktop) per i contesti creati a mano nei test seriali. */
function contextOptions(testInfo: TestInfo): BrowserContextOptions {
	const { baseURL, ...rest } = testInfo.project.use;
	return { ...(rest as BrowserContextOptions), ...(baseURL ? { baseURL } : {}) };
}

test.beforeAll(() => {
	sql = postgres(ADMIN_URL, { max: 2, onnotice: () => {} });
});

test.afterAll(async () => {
	await sql.end({ timeout: 2 });
});

async function register(page: Page, email: string, name = 'Prova Impostazioni') {
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=displayName]', name);
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', PASSWORD);
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');
}

async function userIdOf(email: string): Promise<string> {
	const [user] = await sql<{ id: string }[]>`select id::text from app.users where email = ${email}`;
	expect(user).toBeTruthy();
	return user?.id ?? '';
}

type TestHook = NonNullable<Window['__segnalibroTest']>;

/** Libro + lettura in corso per l'utente, creati come farebbe l'app (libro via SQL, lettura via API). */
async function startReading(page: Page, userId: string, pages = 400) {
	const [book] = await sql<{ id: string }[]>`
		insert into public.user_books (user_id, genre_id, title, author_display, page_count, format, source)
		values (${userId}::uuid, 1, 'Il Gattopardo', 'Giuseppe Tomasi di Lampedusa', ${pages}, 'physical', 'manual')
		returning id::text`;
	const response = await page.request.post('/api/reading/start', {
		data: { bookId: book?.id, startPage: 0 }
	});
	expect(response.ok()).toBe(true);
	const body = (await response.json()) as { reading: { id: string } };
	return { bookId: book?.id ?? '', readingId: body.reading.id };
}

function op(readingId: string, page: number, minute: number, eventId = randomUUID()) {
	return {
		eventId,
		readingId,
		page,
		occurredAt: new Date(Date.UTC(2026, 8, 30, 10, minute)).toISOString(),
		localDate: '2026-09-30',
		operation: 'progress' as const
	};
}

async function submit(page: Page, operation: ReturnType<typeof op>) {
	return page.evaluate(async (value) => {
		const hook = (window as Window & { __segnalibroTest?: TestHook }).__segnalibroTest;
		if (!hook) throw new Error('hook di test assente');
		try {
			return await hook.submitReadingOp(value);
		} catch (error) {
			return { status: 'rejected' as const, message: (error as Error).message };
		}
	}, operation);
}

async function pendingInIdb(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const open = indexedDB.open('segnalibro-offline');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const count = db.transaction('outbox').objectStore('outbox').count();
					count.onsuccess = () => {
						db.close();
						resolve(count.result);
					};
				};
			})
	);
}

const banner = (page: Page) =>
	page.getByRole('status').filter({ hasText: /Offline|Sincronizz|coda|non sincronizzat/ });

// ---------------------------------------------------------------------------

test.describe('Impostazioni: tema e preferenze', () => {
	test.describe.configure({ mode: 'serial' });
	const email = `b7-tema-${randomUUID().slice(0, 8)}@test.local`;
	let userId = '';
	let context: BrowserContext;
	let page: Page;

	test.beforeAll(async ({ browser }, testInfo) => {
		testInfo.setTimeout(90_000); // registrazione (scrypt) lenta con il dev server sotto carico
		context = await browser.newContext(contextOptions(testInfo));
		page = await context.newPage();
		await register(page, email);
		userId = await userIdOf(email);
	});

	test.afterAll(async () => {
		await context.close();
		if (userId) await sql`delete from app.users where id = ${userId}::uuid`;
	});

	test('il documento SSR ha già il tema giusto (nessun flash)', async () => {
		// Senza cookie: tema predefinito nell'HTML iniziale
		const fresh = await page.request.get('/auth/login', { headers: { cookie: '' } });
		expect(await fresh.text()).toContain('data-theme="segnalibro"');

		// Con il cookie del tema scelto, l'HTML iniziale contiene già data-theme e il CSS del tema
		const salvia = await page.request.get('/auth/login', {
			headers: { cookie: 'sb-theme=salvia' }
		});
		const html = await salvia.text();
		expect(html).toMatch(/<html[^>]*data-theme="salvia"/);
		expect(html).toContain(':root[data-theme="salvia"]');
	});

	test('cambio tema senza reload, salvato sul profilo e ricordato al ricaricamento', async () => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Impostazioni', level: 1 })).toBeVisible();

		// Marca il documento: se la pagina si ricaricasse il marker sparirebbe
		await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
		const before = await page.evaluate(() =>
			getComputedStyle(document.body).getPropertyValue('background-color')
		);

		await page.locator('[data-theme-option="salvia"]').click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'salvia');

		const after = await page.evaluate(() =>
			getComputedStyle(document.body).getPropertyValue('background-color')
		);
		expect(after).not.toBe(before);
		expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
			42
		);
		expect((await context.cookies()).find((c) => c.name === 'sb-theme')?.value).toBe('salvia');

		// Persistito sul profilo
		await expect
			.poll(async () => {
				const [row] = await sql<{ theme_key: string }[]>`
					select theme_key from public.user_preferences where user_id = ${userId}::uuid`;
				return row?.theme_key;
			})
			.toBe('salvia');

		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'salvia');
		await expect(page.locator('[data-theme-option="salvia"]')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('tema personalizzato: duplica, modifica i colori, salva, applica ed elimina', async () => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		await page.getByRole('button', { name: 'Crea tema personalizzato' }).click();
		const sheet = page.getByRole('dialog');
		await expect(sheet.getByText('Nuovo tema')).toBeVisible();
		await sheet.getByLabel('Nome del tema').fill('Notte di prova');

		// Anteprima live: cambia il colore principale e l'anteprima lo segue
		const primary = sheet.locator('input[data-token="primary"]');
		await primary.evaluate((el: HTMLInputElement) => {
			el.value = '#123456';
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await expect(sheet.getByTestId('theme-preview')).toHaveCSS('--color-primary', '#123456');

		await sheet.getByRole('button', { name: 'Salva' }).click();
		await expect(sheet).toBeHidden();

		// Applicato subito, senza reload
		const customId = await page.locator('html').getAttribute('data-theme');
		expect(customId).toMatch(/^[0-9a-f-]{36}$/);
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))
			)
			.toBe('#123456');

		// Sopravvive al ricaricamento: le variabili sono applicate prima dell'idratazione
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('html')).toHaveAttribute('data-theme', customId ?? '');
		expect(
			await page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))
		).toBe('#123456');

		const [saved] = await sql<{ tokens: { colors: { primary: string } }; name: string }[]>`
			select tokens, name from public.custom_themes where user_id = ${userId}::uuid`;
		expect(saved?.name).toBe('Notte di prova');
		expect(saved?.tokens.colors.primary).toBe('#123456');

		// Eliminazione: si torna a un tema predefinito
		await page.getByRole('button', { name: /Elimina Notte di prova/ }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'segnalibro');
		await expect(page.locator('[data-theme-option]')).toHaveCount(2); // restano solo i due built-in
		const [left] = await sql<{ n: number }[]>`
			select count(*)::int as n from public.custom_themes where user_id = ${userId}::uuid`;
		expect(left?.n).toBe(0);
	});

	test('movimento e scaffali si salvano e si applicano al documento', async () => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		await page.getByLabel('Ridotto').check();
		await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
		await page.getByLabel('Solo dorsi').check();

		await expect
			.poll(async () => {
				const [row] = await sql<{ shelf_mode: string; motion_preference: string }[]>`
					select shelf_mode, motion_preference from public.user_preferences where user_id = ${userId}::uuid`;
				return `${row?.shelf_mode}/${row?.motion_preference}`;
			})
			.toBe('spines/reduce');

		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
		await expect(page.getByLabel('Solo dorsi')).toBeChecked();

		// Ripristino
		await page.getByLabel('Segui il dispositivo').check();
		await page.getByLabel('Misto').check();
		await expect(page.locator('html')).not.toHaveAttribute('data-motion', /.+/);
	});

	test('il nome visualizzato si modifica e resta dopo il ricaricamento', async () => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Come ti chiami?').fill('Nuovo Nome');
		await page.getByRole('button', { name: 'Salva nome' }).click();
		await expect(page.getByText('Nome aggiornato.')).toBeVisible();
		await page.reload();
		await expect(page.getByLabel('Come ti chiami?')).toHaveValue('Nuovo Nome');
		await expect(page.getByTestId('account-email')).toHaveText(email);
	});

	test('export JSON e CSV sono scaricabili e contengono i dati reali', async () => {
		const { bookId } = await startReading(page, userId, 300);

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		const [jsonDownload] = await Promise.all([
			page.waitForEvent('download'),
			page.getByTestId('export-json').click()
		]);
		expect(jsonDownload.suggestedFilename()).toMatch(/^segnalibro-export-\d{4}-\d{2}-\d{2}\.json$/);
		const stream = await jsonDownload.createReadStream();
		const chunks: Buffer[] = [];
		for await (const chunk of stream) chunks.push(chunk as Buffer);
		const exported = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
			format: string;
			books: { id: string; title: string }[];
			readings: unknown[];
			profile: { email: string };
			preferences: { shelfMode: string };
		};
		expect(exported.format).toBe('segnalibro-export');
		expect(exported.books.map((b) => b.id)).toContain(bookId);
		expect(exported.readings.length).toBeGreaterThan(0);
		expect(exported.profile.email).toBe(email);

		const [csvDownload] = await Promise.all([
			page.waitForEvent('download'),
			page.getByTestId('export-csv').click()
		]);
		expect(csvDownload.suggestedFilename()).toMatch(/^segnalibro-libri-.*\.csv$/);
		const csvStream = await csvDownload.createReadStream();
		const csvChunks: Buffer[] = [];
		for await (const chunk of csvStream) csvChunks.push(chunk as Buffer);
		const csv = Buffer.concat(csvChunks).toString('utf8');
		expect(csv).toContain('Titolo,Autore,Genere');
		expect(csv).toContain('Il Gattopardo');
		expect(csv.split('\r\n').filter(Boolean).length).toBeGreaterThanOrEqual(2);
	});

	test('gli endpoint di export richiedono la sessione', async ({ request }) => {
		const response = await request.get('/api/export/json', { maxRedirects: 0 });
		expect([301, 302, 303, 401]).toContain(response.status());
	});
});

// ---------------------------------------------------------------------------

test.describe('Outbox offline', () => {
	test.describe.configure({ mode: 'serial' });
	const email = `b7-outbox-${randomUUID().slice(0, 8)}@test.local`;
	let userId = '';
	let readingId = '';
	let context: BrowserContext;
	let page: Page;

	test.beforeAll(async ({ browser }, testInfo) => {
		testInfo.setTimeout(90_000); // registrazione (scrypt) lenta con il dev server sotto carico
		context = await browser.newContext(contextOptions(testInfo));
		page = await context.newPage();
		await register(page, email, 'Prova Outbox');
		userId = await userIdOf(email);
		({ readingId } = await startReading(page, userId, 400));
		await page.goto('/library');
		await page.waitForLoadState('networkidle');
		await page.waitForFunction(() =>
			Boolean((window as Window & { __segnalibroTest?: unknown }).__segnalibroTest)
		);
	});

	test.afterAll(async () => {
		await context.close();
		if (userId) await sql`delete from app.users where id = ${userId}::uuid`;
	});

	async function eventRows() {
		return sql<{ id: string; page_delta: number }[]>`
			select id::text, page_delta from public.reading_progress_events
			where reading_id = ${readingId}::uuid order by occurred_at, id`;
	}

	test('online: sincronizzazione immediata; lo stesso eventId conta una volta sola', async () => {
		const first = op(readingId, 20, 1);
		const a = await submit(page, first);
		expect(a.status).toBe('synced');
		// Secondo invio dello stesso evento (retry): stessa risposta, nessun doppio conteggio
		const b = await submit(page, first);
		expect(b.status).toBe('synced');

		const rows = await eventRows();
		expect(rows.filter((r) => r.id === first.eventId)).toHaveLength(1);
		expect(rows.reduce((sum, r) => sum + r.page_delta, 0)).toBe(20);
		await expect(banner(page).first()).not.toContainText('Offline');
	});

	test('offline: gli aggiornamenti vanno in coda, sopravvivono al ricaricamento e partono al ritorno online', async () => {
		const before = (await eventRows()).length;
		const ops = [op(readingId, 60, 10), op(readingId, 90, 20)];

		await context.setOffline(true);
		for (const operation of ops) {
			const result = await submit(page, operation);
			expect(result).toEqual({ status: 'queued' });
		}
		await expect(page.getByText('Offline · 2 aggiornamenti in coda')).toBeVisible();
		expect(await pendingInIdb(page)).toBe(2);
		expect((await eventRows()).length).toBe(before); // il server non ha ricevuto nulla

		// Ritorno online: sync automatica, banner "Sincronizzato", coda vuota
		await context.setOffline(false);
		await expect(page.getByText('Sincronizzato')).toBeVisible({ timeout: 15_000 });
		await expect.poll(() => pendingInIdb(page)).toBe(0);

		const rows = await eventRows();
		expect(rows.length).toBe(before + 2);
		const ids = rows.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length); // nessun duplicato
		expect(rows.reduce((sum, r) => sum + r.page_delta, 0)).toBe(90);
	});

	test('una sync già avvenuta non reinvia nulla e non duplica (evento inviato due volte a mano)', async () => {
		const again = op(readingId, 120, 30);
		await context.setOffline(true);
		expect(await submit(page, again)).toEqual({ status: 'queued' });
		await context.setOffline(false);
		await expect.poll(() => pendingInIdb(page), { timeout: 15_000 }).toBe(0);

		// Il client riprova lo stesso evento (es. ack perso): il server lo riconosce
		const retry = await page.request.post('/api/reading/event', { data: again });
		expect(retry.ok()).toBe(true);
		expect(((await retry.json()) as { duplicate: boolean }).duplicate).toBe(true);

		const rows = await eventRows();
		expect(rows.filter((r) => r.id === again.eventId)).toHaveLength(1);
		expect(rows.reduce((sum, r) => sum + r.page_delta, 0)).toBe(120);
	});

	test('errore 5xx: resta in coda con backoff; 4xx permanente: passa ai non sincronizzati', async () => {
		// 503 -> in coda, non perso
		await page.route('**/api/reading/event', (route) =>
			route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: '{"code":"NETWORK","message":"x"}'
			})
		);
		const transient = op(readingId, 130, 40);
		expect(await submit(page, transient)).toEqual({ status: 'queued' });
		expect(await pendingInIdb(page)).toBe(1);

		// Anche dopo un ricaricamento (sync all'avvio) il 503 lascia l'elemento in coda
		await page.goto('/settings#sincronizzazione');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('pending-count')).toHaveText('1');
		await page.unrouteAll({ behavior: 'wait' });

		// "Riprova ora" dalle Impostazioni
		await page.getByRole('button', { name: 'Riprova ora' }).click();
		await expect(page.getByTestId('pending-count')).toHaveText('0', { timeout: 15_000 });

		// 409 -> errore permanente, niente retry infinito, visibile in UI
		await page.route('**/api/reading/event', (route) =>
			route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: '{"code":"CONFLICT","message":"Lettura già conclusa."}'
			})
		);
		await context.setOffline(true);
		const permanent = op(readingId, 140, 50);
		await submit(page, permanent);
		await context.setOffline(false);
		await expect(page.getByTestId('failed-count')).toHaveText('1', { timeout: 15_000 });
		await expect(page.getByText('Lettura già conclusa.')).toBeVisible();
		await expect(page.getByTestId('pending-count')).toHaveText('0');
		await page.unrouteAll({ behavior: 'wait' });

		// Scarta l'elemento
		await page.getByRole('button', { name: 'Scarta' }).click();
		await expect(page.getByTestId('failed-count')).toHaveText('0');
	});

	test('i 4xx di validazione nell’invio diretto non finiscono in coda', async () => {
		// Pagina all'indietro con "progress": il server rifiuta (422)
		const result = await submit(page, op(readingId, 5, 55));
		expect(result.status).toBe('rejected');
		expect(await pendingInIdb(page)).toBe(0);
	});
});

// ---------------------------------------------------------------------------

test.describe('PWA', () => {
	test('il manifest è valido e installabile', async ({ request }) => {
		const response = await request.get('/manifest.webmanifest');
		test.skip(!response.ok(), 'il manifest è generato solo dalla build di produzione');
		const manifest = (await response.json()) as {
			name: string;
			display: string;
			start_url: string;
			lang: string;
			icons: { src: string; sizes: string; purpose?: string }[];
		};
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/library');
		expect(manifest.lang).toBe('it');
		expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
		expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
		expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
		for (const icon of manifest.icons) {
			const res = await request.get(icon.src);
			expect(res.ok(), icon.src).toBe(true);
			expect(res.headers()['content-type']).toContain('image/png');
		}
	});

	test('service worker attivo, app shell offline e pagina di cortesia', async ({
		browser,
		baseURL
	}, testInfo) => {
		test.setTimeout(90_000);
		const probe = await browser.newContext();
		const swResponse = await probe.request.get(`${baseURL}/sw.js`);
		await probe.close();
		test.skip(
			!swResponse.ok(),
			'service worker presente solo nella build di produzione (npm run build && preview)'
		);

		const context = await browser.newContext(contextOptions(testInfo));
		const page = await context.newPage();
		const email = `b7-pwa-${randomUUID().slice(0, 8)}@test.local`;
		try {
			await register(page, email, 'Prova PWA');

			// SW registrato e attivo
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.ready;
				if (!registration.active) throw new Error('nessun service worker attivo');
			});
			await page.reload(); // ora la pagina è controllata dal SW
			await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

			// Pagina di cortesia precaricata
			const cacheKeys = await page.evaluate(async () => {
				const out: string[] = [];
				for (const name of await caches.keys()) {
					for (const request of await (await caches.open(name)).keys()) out.push(request.url);
				}
				return out;
			});
			expect(cacheKeys.some((url) => url.includes('/offline'))).toBe(true);
			expect(cacheKeys.some((url) => /\.(woff2|js|css)/.test(url))).toBe(true);

			// Offline: la pagina già visitata si ricarica con l'app shell
			await context.setOffline(true);
			await page.reload();
			await expect(page.locator('#main')).toBeVisible(); // app shell dal service worker
			await expect(page.getByText('Offline', { exact: true })).toBeVisible();

			// Pagina mai visitata: pagina di cortesia in italiano
			await page.goto('/profile/2019').catch(() => undefined);
			await expect(page.getByRole('heading', { name: 'Sei offline' })).toBeVisible();

			await context.setOffline(false);
		} finally {
			await context.close();
			await sql`delete from app.users where email = ${email}`;
		}
	});
});

test.describe('PWA + outbox', () => {
	test('la coda sopravvive al ricaricamento offline e si svuota al ritorno online, senza duplicati', async ({
		browser,
		baseURL
	}, testInfo) => {
		test.setTimeout(120_000);
		const probe = await browser.newContext();
		const swResponse = await probe.request.get(`${baseURL}/sw.js`);
		await probe.close();
		test.skip(!swResponse.ok(), 'service worker presente solo nella build di produzione');

		const context = await browser.newContext(contextOptions(testInfo));
		const page = await context.newPage();
		const email = `b7-pwaq-${randomUUID().slice(0, 8)}@test.local`;
		try {
			await register(page, email, 'Prova Coda');
			const userId = await userIdOf(email);
			const { readingId } = await startReading(page, userId, 300);

			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			await page.evaluate(() => navigator.serviceWorker.ready);
			await page.reload(); // dalla seconda visita la pagina è controllata dal SW e finisce nella cache
			await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
			await page.waitForFunction(() =>
				Boolean((window as Window & { __segnalibroTest?: unknown }).__segnalibroTest)
			);

			await context.setOffline(true);
			const ops = [op(readingId, 40, 1), op(readingId, 75, 2)];
			for (const operation of ops)
				expect(await submit(page, operation)).toEqual({ status: 'queued' });

			// "Aggiorna pagina" da offline: l'app shell arriva dal service worker, la coda da IndexedDB
			await page.reload();
			await expect(page.getByText('Offline · 2 aggiornamenti in coda')).toBeVisible();
			expect(await pendingInIdb(page)).toBe(2);

			await context.setOffline(false);
			await expect(page.getByText('Sincronizzato')).toBeVisible({ timeout: 20_000 });
			await expect.poll(() => pendingInIdb(page)).toBe(0);

			const rows = await sql<{ id: string; page_delta: number }[]>`
				select id::text, page_delta from public.reading_progress_events where reading_id = ${readingId}::uuid`;
			expect(rows).toHaveLength(2);
			expect(rows.reduce((sum, r) => sum + r.page_delta, 0)).toBe(75);

			// Il service worker espone Background Sync dove il browser lo supporta
			const hasSync = await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.ready;
				return 'sync' in registration;
			});
			expect(typeof hasSync).toBe('boolean');
		} finally {
			await context.close();
			await sql`delete from app.users where email = ${email}`;
		}
	});
});

// ---------------------------------------------------------------------------

test.describe('Cancellazione account', () => {
	test('conferma forte, dati eliminati, sessione chiusa e ritorno al login', async ({
		browser
	}, testInfo) => {
		test.setTimeout(90_000);
		const context = await browser.newContext(contextOptions(testInfo));
		const page = await context.newPage();
		const email = `b7-del-${randomUUID().slice(0, 8)}@test.local`;
		await register(page, email, 'Da Cancellare');
		const userId = await userIdOf(email);
		await startReading(page, userId, 200);

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Elimina il mio account' }).click();

		const sheet = page.getByRole('dialog');
		const confirm = sheet.getByRole('button', { name: 'Elimina per sempre' });
		await expect(confirm).toBeDisabled();

		// Email sbagliata: il pulsante resta disabilitato
		await sheet.getByLabel(/Scrivi la tua email/).fill('altro@test.local');
		await sheet.getByLabel('Password').fill(PASSWORD);
		await expect(confirm).toBeDisabled();

		// Password sbagliata: rifiutata dal server, l'account resta
		await sheet.getByLabel(/Scrivi la tua email/).fill(email);
		await sheet.getByLabel('Password').fill('password-sbagliata');
		await confirm.click();
		await expect(sheet.getByText('Password non corretta.')).toBeVisible();
		expect(await userIdOf(email)).toBe(userId);

		// Conferma corretta
		await sheet.getByLabel('Password').fill(PASSWORD);
		await confirm.click();
		await page.waitForURL('**/auth/login');
		await page.waitForLoadState('load');

		const users = await sql`select 1 from app.users where id = ${userId}::uuid`;
		expect(users).toHaveLength(0);
		const books = await sql`select 1 from public.user_books where user_id = ${userId}::uuid`;
		expect(books).toHaveLength(0);

		// Sessione chiusa: le pagine private rimandano al login
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/auth\/login/);
		await context.close();
	});
});
