import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const ADMIN_URL =
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';
const PASSWORD = 'Libreria-e2e-2026!';

let sql: postgres.Sql;

test.beforeAll(() => {
	sql = postgres(ADMIN_URL, { max: 2, onnotice: () => {} });
});

test.afterAll(async () => {
	await sql.end({ timeout: 2 });
});

/** Utente di prova (mai il demo) con 5 libri nei Classici e 3 nella coda. */
async function setup(page: Page, label: string) {
	const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=displayName]', 'Lettrice Test');
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', PASSWORD);
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');

	const [user] = await sql<{ id: string }[]>`select id::text from app.users where email = ${email}`;
	const userId = user?.id ?? '';
	expect(userId).not.toBe('');

	const ids: Record<string, string> = {};
	for (const [i, key] of ['A', 'B', 'C', 'D', 'E'].entries()) {
		const [row] = await sql<{ id: string }[]>`
			insert into public.user_books (user_id, genre_id, title, author_display, page_count, language, format, source)
			values (${userId}::uuid, 1, ${`Libro ${key}`}, 'Autore Prova', ${150 + i * 90}, 'it', 'physical', 'manual')
			returning id::text`;
		ids[key] = row?.id ?? '';
	}
	for (const [i, key] of ['A', 'B', 'C'].entries()) {
		await sql`insert into public.reading_queue (user_id, user_book_id, position)
			values (${userId}::uuid, ${ids[key] ?? ''}::uuid, ${i + 1})`;
	}
	return { userId, ids };
}

async function cleanup(userId: string) {
	if (userId) await sql`delete from app.users where id = ${userId}::uuid`;
}

const queueTitles = async (userId: string) =>
	(
		await sql<{ title: string }[]>`
			select b.title from public.reading_queue q join public.user_books b on b.id = q.user_book_id
			where q.user_id = ${userId}::uuid order by q.position`
	).map((r) => r.title);

/** Trascina con il mouse: il drag parte appena il puntatore supera la soglia. */
async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 14, from.y - 6, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 16 });
	await page.mouse.up();
}

async function center(page: Page, locator: ReturnType<Page['locator']>) {
	await locator.scrollIntoViewIfNeeded();
	const box = await locator.boundingBox();
	if (!box) throw new Error('elemento non visibile');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Home Libreria', () => {
	test('scaffali, coda e stato della Home', async ({ page }) => {
		test.setTimeout(60_000);
		const { userId } = await setup(page, 'home');
		try {
			await page.goto('/library');
			await expect(page.getByRole('heading', { name: 'Libreria', level: 1 })).toBeVisible();
			await expect(page.getByText('Ciao Lettrice Test, cosa leggi oggi?')).toBeVisible();
			// scansione ISBN solo su mobile, "Aggiungi libro" sempre
			await expect(page.locator('a[href="/add/scan"]')).toHaveCount(1);
			await expect(
				page.getByRole('main').getByRole('link', { name: 'Aggiungi libro' })
			).toHaveAttribute('href', '/add');
			await expect(page.getByRole('region', { name: /^I prossimi, 3 libri/ })).toBeVisible();
			await expect(page.getByText('3 su 3')).toBeVisible();
			// I link di raccolta stanno nell'intestazione, senza avvolgere i controlli dello scaffale.
			await expect(page.getByRole('link', { name: 'Vedi tutti: In lettura' })).toHaveAttribute(
				'href',
				'/library?collection=reading'
			);
			await expect(page.getByRole('link', { name: 'Vedi tutti: I prossimi 3' })).toHaveAttribute(
				'href',
				'/library?collection=queue'
			);
			await page.getByRole('link', { name: 'Vedi tutti: I prossimi 3' }).click();
			await expect(page).toHaveURL(/\/library\?collection=queue$/);
			await expect(page.getByRole('heading', { name: 'I prossimi', level: 2 })).toBeVisible();
			await expect(page.getByText('3 libri', { exact: true })).toBeVisible();
			await page.getByRole('link', { name: 'Tutti gli scaffali' }).click();
			await expect(page).toHaveURL(/\/library$/);
			// 7 scaffali nell'ordine della spec, titolo toccabile
			const genres = page.getByRole('link', {
				name: /Classici|Mitologia|Distopia|Thriller|Fantasy|Romance|Contemporanea/
			});
			await expect(genres.first()).toHaveAttribute('href', '/genre/classics');
			await expect(page.locator('a[href^="/genre/"]')).toHaveCount(7);
			// dorso di un libro -> dettaglio
			await expect(page.locator('a[href^="/book/"][aria-label^="Libro D"]').first()).toBeVisible();
			// ricerca: nasconde in lettura/prossimi e filtra gli scaffali
			await page.getByLabel('Cerca nella libreria').fill('libro d');
			await expect(page.getByText(/trovat[oi] per «libro d»/)).toBeVisible();
			await expect(page.getByRole('region', { name: /^I prossimi/ })).toBeHidden();
			await expect(page.locator('a[href^="/book/"][aria-label^="Libro D"]').first()).toBeVisible();
			await page.getByRole('button', { name: 'Cancella la ricerca' }).click();
			// vista elenco
			await page.getByRole('button', { name: 'Vista elenco' }).click();
			await expect(page.getByRole('button', { name: 'Vista elenco' })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await page.getByRole('button', { name: 'Vista scaffali' }).click();
		} finally {
			await cleanup(userId);
		}
	});

	test('soft limit: quarto libro nei prossimi con conferma', async ({ page }, info) => {
		test.skip(info.project.name !== 'desktop', 'drag con il mouse');
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 1280, height: 2400 });
		const { userId } = await setup(page, 'queue');
		try {
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			const source = page.locator('a[href^="/book/"][aria-label^="Libro D"]').first();
			const queue = page.getByRole('region', { name: /^I prossimi/ });

			// Annulla: non cambia nulla
			await mouseDrag(page, await center(page, source), await center(page, queue.locator('.slot')));
			const dialog = page.getByRole('alertdialog');
			await expect(dialog).toContainText(
				'Hai già 3 libri nelle prossime letture. Vuoi aggiungerlo comunque?'
			);
			await dialog.getByRole('button', { name: 'Annulla' }).click();
			await expect(dialog).toBeHidden();
			expect(await queueTitles(userId)).toEqual(['Libro A', 'Libro B', 'Libro C']);

			// Aggiungi comunque
			await mouseDrag(page, await center(page, source), await center(page, queue.locator('.slot')));
			await dialog.getByRole('button', { name: 'Aggiungi comunque' }).click();
			await expect(dialog).toBeHidden();
			await expect(page.getByText('4 libri', { exact: true }).first()).toBeVisible();
			await expect
				.poll(() => queueTitles(userId))
				.toEqual(['Libro A', 'Libro B', 'Libro C', 'Libro D']);
		} finally {
			await cleanup(userId);
		}
	});

	test('drag su un altro scaffale cambia il genere', async ({ page }, info) => {
		test.skip(info.project.name !== 'desktop', 'drag con il mouse');
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 1280, height: 2400 });
		const { userId, ids } = await setup(page, 'genre');
		try {
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			const source = page.locator('a[href^="/book/"][aria-label^="Libro E"]').first();
			const target = page.getByRole('region', { name: /^Scaffale Mitologia/ });

			await mouseDrag(
				page,
				await center(page, source),
				await center(page, target.locator('.plank'))
			);
			await expect(target.locator('a[aria-label^="Libro E"]')).toBeVisible();
			await expect
				.poll(async () => {
					const [row] = await sql<
						{ genre_id: number }[]
					>`select genre_id from public.user_books where id = ${ids['E'] ?? ''}::uuid`;
					return row?.genre_id;
				})
				.toBe(2);
		} finally {
			await cleanup(userId);
		}
	});

	test('riordino dei prossimi trascinando', async ({ page }, info) => {
		test.skip(info.project.name !== 'desktop', 'drag con il mouse');
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 1280, height: 2400 });
		const { userId } = await setup(page, 'reorder');
		try {
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			const queue = page.getByRole('region', { name: /^I prossimi/ });
			const third = queue.locator('a[aria-label^="3. Libro C"]');
			const first = queue.locator('a[aria-label^="1. Libro A"]');
			await mouseDrag(page, await center(page, third), await center(page, first));
			await expect.poll(() => queueTitles(userId)).toEqual(['Libro C', 'Libro A', 'Libro B']);
			await expect(queue.locator('a[aria-label^="1. Libro C"]')).toBeVisible();
		} finally {
			await cleanup(userId);
		}
	});

	test('riordino e rimozione con il menu accessibile', async ({ page }) => {
		test.setTimeout(60_000);
		const { userId } = await setup(page, 'menu');
		try {
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			await page.getByRole('button', { name: 'Azioni per Libro A' }).click();
			await page.getByRole('button', { name: 'Sposta giù' }).click();
			await expect.poll(() => queueTitles(userId)).toEqual(['Libro B', 'Libro A', 'Libro C']);

			await page.getByRole('button', { name: 'Azioni per Libro C' }).click();
			await page.getByRole('button', { name: 'Rimuovi dai prossimi' }).click();
			await expect.poll(() => queueTitles(userId)).toEqual(['Libro B', 'Libro A']);
			await expect(page.getByText('2 su 3')).toBeVisible();
		} finally {
			await cleanup(userId);
		}
	});

	test('touch: pressione lunga e trascinamento su uno scaffale', async ({
		page,
		context
	}, info) => {
		test.skip(info.project.name !== 'mobile', 'solo touch');
		test.setTimeout(90_000);
		await page.setViewportSize({ width: 412, height: 2600 });
		const { userId, ids } = await setup(page, 'touch');
		try {
			await page.goto('/library');
			await page.waitForLoadState('networkidle');
			const source = page.locator('a[href^="/book/"][aria-label^="Libro E"]').first();
			const target = page.getByRole('region', { name: /^Scaffale Thriller/ });
			const from = await center(page, source);
			const to = await center(page, target.locator('.plank'));

			const cdp = await context.newCDPSession(page);
			const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
				cdp.send('Input.dispatchTouchEvent', {
					type,
					touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
				});
			await touch('touchStart', from.x, from.y);
			await page.waitForTimeout(550); // pressione lunga
			for (let i = 1; i <= 12; i++) {
				await touch(
					'touchMove',
					from.x + ((to.x - from.x) * i) / 12,
					from.y + ((to.y - from.y) * i) / 12
				);
				await page.waitForTimeout(16);
			}
			await expect(page.getByText('Rilascia qui')).toBeVisible();
			await touch('touchEnd', to.x, to.y);

			await expect(target.locator('a[aria-label^="Libro E"]')).toBeVisible();
			await expect
				.poll(async () => {
					const [row] = await sql<
						{ genre_id: number }[]
					>`select genre_id from public.user_books where id = ${ids['E'] ?? ''}::uuid`;
					return row?.genre_id;
				})
				.toBe(4);
		} finally {
			await cleanup(userId);
		}
	});
});
