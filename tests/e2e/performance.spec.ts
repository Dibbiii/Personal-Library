import { randomUUID } from 'node:crypto';

import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

test.use({ serviceWorkers: 'block' });
let sql: postgres.Sql;
test.beforeAll(() => {
	sql = postgres(
		process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro',
		{ max: 2, onnotice: () => {} }
	);
});
test.afterAll(() => sql.end({ timeout: 2 }));
test.beforeEach(async ({ page }, testInfo) => {
	await page.setViewportSize(
		testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
	);
});

async function fixture(page: Page) {
	const email = `performance-e2e-${randomUUID()}@test.local`;
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.locator('input[name=displayName]').fill('Prova prestazioni');
	await page.locator('input[name=email]').fill(email);
	await page.locator('input[name=password]').fill('Prestazioni-e2e-2026!');
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');
	const [user] = await sql<{ id: string }[]>`select id from app.users where email=${email}`;
	const id = user!.id;
	await sql`insert into public.user_books(user_id,genre_id,title,author_display,page_count,format,source,lifecycle_state,completed_readings_count)
		select ${id}::uuid,1,'Libro '||n,'Autore '||n,200,'physical','manual',case when n<=85 then 'finished' else 'unread' end,
		case when n<=85 then 1 else 0 end from generate_series(1,170) n`;
	const books = await sql<
		{ id: string; title: string }[]
	>`select id,title from public.user_books where user_id=${id}::uuid and title in ('Libro 1','Libro 2') order by title`;
	return {
		id,
		books,
		cleanup: async () => {
			await sql`delete from app.users where id=${id}::uuid`;
		}
	};
}

test('library search includes every book while rendering results in batches', async ({
	page
}, testInfo) => {
	const fx = await fixture(page);
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	try {
		await page.goto('/library');
		await page.getByRole('button', { name: 'Vista elenco' }).click();
		let requests = 0;
		await page.route('**/api/library/shelf**', async (route) => {
			if (++requests > 1) await gate;
			await route.continue();
		});
		const search = page.getByRole('searchbox', { name: 'Cerca nella libreria' });
		await search.fill('Libro');
		const shelf = page.getByRole('region', { name: 'Scaffale Classici, 170 libri', exact: true });
		await expect(shelf.getByRole('button', { name: 'Mostra altri libri: Classici' })).toBeVisible();
		await expect(shelf.locator('.row-item')).toHaveCount(24);
		await shelf.getByRole('button', { name: 'Mostra altri libri: Classici' }).click();
		await expect(shelf.locator('.row-item')).toHaveCount(48);
		release();
		await expect(page.getByText('170 libri trovati per «Libro»', { exact: true })).toBeVisible();
		await expect(shelf.locator('.row-item')).toHaveCount(48);
		await search.fill('Libro 169');
		await expect(shelf.locator('.row-item')).toHaveCount(1);
		await expect(
			shelf.getByRole('link', { name: 'Libro 169, di Autore 169', exact: true })
		).toBeVisible();
		await page.getByRole('button', { name: 'Cancella la ricerca' }).click();
		await expect(shelf.locator('.row-item')).toHaveCount(24);
		await page.getByRole('button', { name: 'Vista scaffali' }).click();
		// The horizontal viewport can immediately prefetch one extra batch.
		await expect
			.poll(async () => [24, 48].includes(await shelf.locator('a[href^="/book/"]').count()))
			.toBe(true);
		await mkdir('.tempo/performance', { recursive: true });
		await page.screenshot({
			path: `.tempo/performance/library-followup-${testInfo.project.name}.png`,
			fullPage: true
		});
	} finally {
		release();
		await fx.cleanup();
	}
});

test('serif subsets have Unicode ranges and extended characters load on demand', async ({
	page
}) => {
	const fx = await fixture(page);
	try {
		await page.goto('/profile');
		await page.waitForLoadState('networkidle');
		const latin = await page.evaluate(async () => {
			await document.fonts.ready;
			return {
				ranges: [...document.fonts]
					.filter((font) => font.family === 'Young Serif')
					.map((font) => font.unicodeRange),
				requests: performance
					.getEntriesByType('resource')
					.map((entry) => entry.name)
					.filter((name) => name.includes('young-serif-'))
			};
		});
		expect(latin.ranges).toHaveLength(2);
		expect(latin.ranges).not.toContain('U+0-10FFFF');
		expect(latin.requests.some((name) => name.includes('young-serif-latin-400'))).toBe(true);
		expect(latin.requests.some((name) => name.includes('young-serif-latin-ext-400'))).toBe(false);
		const extended = await page.evaluate(async () => {
			await document.fonts.load('24px "Young Serif"', 'Łódź');
			return performance
				.getEntriesByType('resource')
				.some((entry) => entry.name.includes('young-serif-latin-ext-400'));
		});
		expect(extended).toBe(true);
	} finally {
		await fx.cleanup();
	}
});

test('genre pages and orders remain independent, accessible and shareable', async ({
	page
}, testInfo) => {
	const fx = await fixture(page);
	try {
		await page.goto('/genre/classics');
		await page.waitForLoadState('networkidle');
		const read = page.getByRole('navigation', { name: 'Pagine dei libri letti' });
		const unread = page.getByRole('navigation', { name: 'Pagine dei libri da leggere' });
		await expect(read).toContainText('Pagina 1 di 3');
		await expect(unread).toContainText('Pagina 1 di 3');
		await mkdir('.tempo/performance', { recursive: true });
		await page.screenshot({
			path: `.tempo/performance/genre-${testInfo.project.name}.png`,
			fullPage: true
		});
		await page.screenshot({
			path: `.tempo/performance/genre-viewport-${testInfo.project.name}.png`
		});
		await unread.getByRole('link', { name: 'Successiva' }).click();
		await expect(page).toHaveURL(/unreadPage=2/);
		await expect(unread).toContainText('Pagina 2 di 3');
		await expect(read).toContainText('Pagina 1 di 3');
		await page
			.getByRole('group', { name: 'Ordina i libri da leggere' })
			.getByRole('button', { name: 'Pagine' })
			.click();
		await expect(page).toHaveURL(/unreadSort=pages/);
		await expect(unread).toContainText('Pagina 1 di 3');
		await page.goto('/genre/classics?readPage=999999&unreadPage=999999');
		await expect(read).toContainText('Pagina 3 di 3');
		await expect(unread).toContainText('Pagina 3 di 3');
		await expect(page).toHaveURL(/readPage=3&unreadPage=3/);
	} finally {
		await fx.cleanup();
	}
});

test('quote filters include books outside the first page and all 601 quotes are reachable', async ({
	page
}) => {
	const fx = await fixture(page);
	try {
		await sql`insert into public.quotes(user_id,user_book_id,body)
			select ${fx.id}::uuid,${fx.books[0]!.id}::uuid,'Citazione '||n from generate_series(1,600) n`;
		await sql`insert into public.quotes(user_id,user_book_id,body,created_at)
			values(${fx.id}::uuid,${fx.books[1]!.id}::uuid,'Frase fuori dalla prima pagina','2020-01-01T00:00:00Z')`;
		await page.goto('/quotes');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('quotes-page').locator('ul.list > li')).toHaveCount(30);
		await page.getByTestId('quotes-filter').selectOption(fx.books[1]!.id);
		await expect(
			page.locator('blockquote').filter({ hasText: 'Frase fuori dalla prima pagina' })
		).toBeVisible();
		await expect(page.getByTestId('quotes-page').locator('ul.list > li')).toHaveCount(1);
		await page.goto('/quotes?page=21');
		await expect(
			page.locator('blockquote').filter({ hasText: 'Frase fuori dalla prima pagina' })
		).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Pagine delle citazioni' })).toContainText(
			'Pagina 21 di 21'
		);
		await page.goBack();
		await expect(page.getByTestId('quotes-filter')).toHaveValue(fx.books[1]!.id);
	} finally {
		await fx.cleanup();
	}
});

test('profile totals use the whole library and secondary tabs render in SSR', async ({ page }) => {
	const fx = await fixture(page);
	try {
		await page.goto('/profile');
		await expect(page.getByTestId('profile-overview')).toBeVisible();
		await expect(page.locator('.bio')).toContainText('170 libri in libreria');
		await expect(
			page.locator('.counters > div').filter({ hasText: 'Libri letti' }).locator('dd')
		).toHaveText('85');
		await expect(
			page.locator('.counters > div').filter({ hasText: 'Da leggere' }).locator('dd')
		).toHaveText('85');
		const response = await page.request.get('/profile?tab=stats');
		expect(response.ok()).toBe(true);
		expect(await response.text()).toContain('data-testid="stats-page"');
		for (const [tab, label] of [
			['stats', 'Statistiche'],
			['activity', 'Attività'],
			['wheel', 'Ruota della fortuna'],
			['calendar', 'Calendario'],
			['dnf', 'Abbandonati']
		] as const) {
			await page
				.getByRole('navigation', { name: 'Sezioni del profilo' })
				.getByRole('link', { name: label, exact: true })
				.click();
			await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
			await expect(page.getByTestId('profile-page')).toBeVisible();
		}
	} finally {
		await fx.cleanup();
	}
});
