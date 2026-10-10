import '../helpers/env';
import { randomUUID } from 'node:crypto';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { genreSlugSchema, type GenreSlug } from '../../src/lib/contracts/enums';
import { GENRE_LABELS } from '../../src/lib/genres';
import { closeDb } from '../../src/lib/server/db';
import { adminSql, closeAdminSql, createTestUser, type TestUser } from '../helpers/users';

const CLASSICS = genreSlugSchema.enum.classics;
const MYTHOLOGY = genreSlugSchema.enum['mythology-epic-retelling'];
const addLabel = (slug: GenreSlug) => `Aggiungi un libro a ${GENRE_LABELS[slug]}`;

// Ogni test/progetto ha un account nuovo: nessuna mutazione del demo e nessun reset.
const test = base.extend<{ account: TestUser }>({
	account: async ({ page }, use) => {
		const account = await createTestUser('library-management-e2e');
		try {
			await page.goto('/auth/login');
			await page.waitForLoadState('networkidle');
			await page.getByLabel('Email').fill(account.email);
			await page.getByLabel('Password', { exact: true }).fill(account.password);
			await page.getByRole('button', { name: 'Accedi', exact: true }).click();
			await page.waitForURL('**/library');
			await use(account);
		} finally {
			await account.cleanup();
		}
	}
});

test.afterAll(async () => {
	await closeAdminSql();
	await closeDb();
});

async function seedBook(account: TestUser, title = 'Libro da eliminare') {
	const bookId = randomUUID();
	await adminSql()`insert into public.user_books
		(id, user_id, genre_id, title, author_display, page_count, language, format, source)
		values (${bookId}::uuid, ${account.id}::uuid, 1, ${title}, 'Autore Test', 200, 'it', 'physical', 'manual')`;
	return bookId;
}

async function openRemoval(page: Page, bookId: string) {
	await page.goto(`/book/${bookId}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Altre azioni', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Elimina dalla libreria', exact: true }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Eliminare «Libro da eliminare»?' });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function followAddLink(page: Page, link: Locator, slug: GenreSlug) {
	await expect(link).toBeVisible();
	await link.focus();
	await expect(link).toBeFocused();
	await link.click();
	await expect(page).toHaveURL(
		(url) => url.pathname === '/add' && url.searchParams.get('genre') === slug
	);
}

test.describe('Aggiunta ed eliminazione dalla libreria', () => {
	test.setTimeout(60_000);

	test('il colore del genere non modifica la navbar globale', async ({ page, account }) => {
		await seedBook(account, 'Libro a tema');
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`/genre/${CLASSICS}`);
		await page.waitForLoadState('networkidle');

		// Simula una palette globale nettamente distinta dal colore del genere corrente.
		await page.evaluate(() => {
			const root = document.documentElement;
			root.dataset.appearance = 'light';
			root.style.setProperty('--color-background', '#ff0000');
			root.style.setProperty('--color-background-shelf', '#ee0000');
			root.style.setProperty('--color-surface', '#dd0000');
			root.style.setProperty('--color-primary', '#cc0000');
		});

		const mobile = await page.evaluate(() => {
			const content = document.querySelector<HTMLElement>('.content[data-genre="classics"]');
			const nav = document.querySelector<HTMLElement>('.bottom-nav');
			const addBook = document.querySelector<HTMLElement>('.bottom-nav .add-book');
			if (!content || !nav || !addBook) throw new Error('Navigazione mobile non trovata');
			return {
				genre: getComputedStyle(content).getPropertyValue('--genre-current').trim(),
				genreBase: getComputedStyle(document.documentElement)
					.getPropertyValue('--genre-classics')
					.trim(),
				navBackground: getComputedStyle(nav).backgroundColor,
				navBorder: getComputedStyle(nav).borderTopColor,
				addBookBackground: getComputedStyle(addBook).backgroundColor
			};
		});

		expect(mobile.genre).toBe(mobile.genreBase);
		expect(mobile.navBackground).toBe('rgb(255, 0, 0)');
		expect(mobile.navBorder).toBe('rgb(221, 0, 0)');
		expect(mobile.addBookBackground).toBe('rgb(204, 0, 0)');

		await page.setViewportSize({ width: 1280, height: 800 });
		const sidebar = page.locator('.sidebar');
		await expect(sidebar).toBeVisible();
		const desktop = await page.evaluate(() => {
			const nav = document.querySelector<HTMLElement>('.sidebar');
			const activeLink = document.querySelector<HTMLElement>('.sidebar .link.active');
			if (!nav || !activeLink) throw new Error('Navigazione desktop non trovata');
			return {
				navBackground: getComputedStyle(nav).backgroundColor,
				activeBackground: getComputedStyle(activeLink).backgroundColor
			};
		});
		expect(desktop.navBackground).toBe('rgb(238, 0, 0)');
		expect(desktop.activeBackground).toBe('rgb(204, 0, 0)');
	});

	test('aggiunta contestuale: scaffale vuoto in Home e header genere (niente + sugli scaffali popolati)', async ({
		page,
		account
	}, testInfo) => {
		await page.setViewportSize(
			testInfo.project.name === 'mobile'
				? { width: 390, height: 844 }
				: { width: 1280, height: 800 }
		);
		const bookId = await seedBook(account);
		await page.goto('/library');
		await page.waitForLoadState('networkidle');
		const populated = page.getByRole('region', {
			name: `Scaffale ${GENRE_LABELS[CLASSICS]}, 1 libro`,
			exact: true
		});
		const empty = page.getByRole('region', {
			name: `Scaffale ${GENRE_LABELS[MYTHOLOGY]}, 0 libri`,
			exact: true
		});
		const emptyAdd = empty.getByRole('link', {
			name: `${addLabel(MYTHOLOGY)}, scaffale vuoto`,
			exact: true
		});
		await expect(populated.locator(`a[href="/book/${bookId}"]`)).toBeVisible();
		// L'aggiunta generica sta nella toolbar: gli scaffali popolati non hanno il +.
		await expect(populated.locator('a[href^="/add"]')).toHaveCount(0);
		await expect(emptyAdd).toHaveAttribute('href', `/add?genre=${MYTHOLOGY}`);
		// Il link del titolo resta indipendente dall’azione +.
		await expect(populated.getByRole('link', { name: /^Vedi tutti/ })).toHaveAttribute(
			'href',
			`/genre/${CLASSICS}`
		);
		await testInfo.attach('library-home', {
			body: await page.screenshot({ fullPage: true, scale: 'css' }),
			contentType: 'image/png'
		});
		await followAddLink(page, emptyAdd, MYTHOLOGY);
		for (const slug of [CLASSICS, MYTHOLOGY]) {
			await page.goto(`/genre/${slug}`);
			await page.waitForLoadState('networkidle');
			const add = page.getByRole('link', { name: addLabel(slug), exact: true });
			await expect(add).toHaveAttribute('href', `/add?genre=${slug}`);
			await testInfo.attach(`library-genre-${slug}`, {
				body: await page.screenshot({ fullPage: true, scale: 'css' }),
				contentType: 'image/png'
			});
			await followAddLink(page, add, slug);
		}
	});

	for (const entry of ['home', 'genre'] as const) {
		test(`aggiunta manuale da ${entry}: conserva il genere fino alla conferma e al salvataggio`, async ({
			page,
			account
		}) => {
			await page.route('**/api/catalog/**', (route) => route.abort('internetdisconnected'));
			await page.goto(entry === 'home' ? '/library' : `/genre/${CLASSICS}`);
			await page.waitForLoadState('networkidle');
			const add =
				entry === 'home'
					? page
							.getByRole('region', {
								name: `Scaffale ${GENRE_LABELS[CLASSICS]}, 0 libri`,
								exact: true
							})
							.getByRole('link', { name: `${addLabel(CLASSICS)}, scaffale vuoto`, exact: true })
					: page.getByRole('link', { name: addLabel(CLASSICS), exact: true });
			await followAddLink(page, add, CLASSICS);
			for (const [name, path] of [
				[/Scansiona ISBN/, 'scan'],
				[/^Cerca/, 'search'],
				[/Inserisci manualmente/, 'manual']
			] as const) {
				await expect(page.getByRole('link', { name })).toHaveAttribute(
					'href',
					`/add/${path}?genre=${CLASSICS}`
				);
			}
			await page.getByRole('link', { name: /Inserisci manualmente/ }).click();
			await expect(page).toHaveURL(
				(url) => url.pathname === '/add/manual' && url.searchParams.get('genre') === CLASSICS
			);
			await page.waitForLoadState('networkidle');
			const title = `Inserimento ${entry} ${randomUUID().slice(0, 8)}`;
			await page.getByLabel('Titolo', { exact: true }).fill(title);
			await page.getByLabel('Autore', { exact: true }).fill('Autore Manuale');
			await page.getByLabel('Pagine', { exact: true }).fill('240');
			await page.getByRole('button', { name: 'Continua', exact: true }).click();
			const sheet = page.getByRole('dialog', { name: 'Aggiungi alla libreria' });
			await expect(sheet).toBeVisible();
			await expect(
				sheet.getByRole('radio', { name: GENRE_LABELS[CLASSICS], exact: true })
			).toBeChecked();
			// Il contesto è una preselezione, non blocca la scelta manuale.
			const mythology = sheet.getByRole('radio', { name: GENRE_LABELS[MYTHOLOGY], exact: true });
			await mythology.locator('xpath=..').click();
			await expect(mythology).toBeChecked();
			const classics = sheet.getByRole('radio', { name: GENRE_LABELS[CLASSICS], exact: true });
			await classics.locator('xpath=..').click();
			await expect(classics).toBeChecked();
			await sheet.getByRole('button', { name: 'Aggiungi', exact: true }).click();
			await page.waitForURL(/\/book\/[0-9a-f-]{36}$/);
			await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
			const rows = await adminSql()<{ id: string; slug: string; source: string }[]>`
				select b.id::text, g.slug, b.source from public.user_books b
				join public.genres g on g.id = b.genre_id
				where b.user_id = ${account.id}::uuid and b.title = ${title}`;
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ slug: CLASSICS, source: 'manual' });
			expect(page.url()).toContain(`/book/${rows[0]!.id}`);
		});
	}

	test('eliminazione: avviso irreversibile, focus su Annulla, annullamento e successo persistente', async ({
		page,
		account
	}) => {
		const bookId = await seedBook(account);
		const remainingId = await seedBook(account, 'Libro da conservare');
		await adminSql()`insert into public.reading_queue (user_id, user_book_id, position)
			values (${account.id}::uuid, ${bookId}::uuid, 1), (${account.id}::uuid, ${remainingId}::uuid, 2)`;
		let removalRequests = 0;
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/library/remove') removalRequests++;
		});
		const dialog = await openRemoval(page, bookId);
		await expect(dialog).toContainText('L’operazione è irreversibile.');
		await expect(dialog).toContainText('cronologia di lettura');
		await expect(dialog).toContainText('citazioni');
		await expect(dialog).toContainText('Bingo');
		await expect(dialog.getByRole('button', { name: 'Annulla', exact: true })).toBeFocused();
		await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
		await expect(dialog).toBeHidden();
		expect(removalRequests).toBe(0);
		await expect(page).toHaveURL(new RegExp(`/book/${bookId}$`));
		expect(
			await adminSql()`select id from public.user_books where id = ${bookId}::uuid`
		).toHaveLength(1);
		expect([
			...(await adminSql()`select position from public.reading_queue where user_id = ${account.id}::uuid order by position`)
		]).toEqual([{ position: 1 }, { position: 2 }]);

		await page.getByRole('button', { name: 'Altre azioni', exact: true }).click();
		await page.getByRole('menuitem', { name: 'Elimina dalla libreria', exact: true }).click();
		const [response] = await Promise.all([
			page.waitForResponse(
				(response) =>
					new URL(response.url()).pathname === '/api/library/remove' &&
					response.request().method() === 'POST'
			),
			dialog.getByRole('button', { name: 'Elimina dalla libreria', exact: true }).click()
		]);
		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({
			contractVersion: 1,
			bookId,
			readingIds: [],
			clearedBingoCells: 0
		});
		await expect(page).toHaveURL((url) => url.pathname === `/genre/${CLASSICS}`);
		expect(removalRequests).toBe(1);
		await expect(page.locator(`a[href="/book/${bookId}"]`)).toHaveCount(0);
		await expect(page.locator(`a[href="/book/${remainingId}"]`).first()).toBeVisible();
		expect(
			await adminSql()`select id from public.user_books where id = ${bookId}::uuid`
		).toHaveLength(0);
		expect([
			...(await adminSql()`select user_book_id::text, position from public.reading_queue where user_id = ${account.id}::uuid`)
		]).toEqual([{ user_book_id: remainingId, position: 1 }]);
		await page.goto('/library');
		await expect(page.locator(`a[href="/book/${bookId}"]`)).toHaveCount(0);
		await expect(page.locator(`a[href="/book/${remainingId}"]`).first()).toBeVisible();
		const missing = await page.goto(`/book/${bookId}`);
		expect(missing?.status()).toBe(404);
	});

	test('offline: il guard blocca l’eliminazione senza inviare richieste né mutare il libro', async ({
		page,
		context,
		account
	}) => {
		const bookId = await seedBook(account);
		const dialog = await openRemoval(page, bookId);
		let removalRequests = 0;
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/library/remove') removalRequests++;
		});
		await context.setOffline(true);
		try {
			await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
			await dialog.getByRole('button', { name: 'Elimina dalla libreria', exact: true }).click();
			await expect(dialog.getByRole('alert')).toContainText('devi essere online');
			await expect(dialog).toBeVisible();
			expect(removalRequests).toBe(0);
			expect(
				await adminSql()`select id from public.user_books where id = ${bookId}::uuid`
			).toHaveLength(1);
			await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
			await expect(dialog).toBeHidden();
		} finally {
			await context.setOffline(false);
		}
	});
});
