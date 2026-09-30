import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { shortTitle, sliceIndexAtPointer } from '../../src/lib/explore/wheel';

const ADMIN_URL =
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';

const PASSWORD = 'Esplora-e2e-2026!';

/** genre_id: 1 Classici, 2 Mitologia, 3 Distopia, 4 Thriller, 5 Fantasy, 6 Romance, 7 Contemporanea */
const BOOKS = [
	{ title: 'Orgoglio e pregiudizio', author: 'Jane Austen', genre: 1 },
	{ title: 'Madame Bovary', author: 'Gustave Flaubert', genre: 1 },
	{ title: 'Il Gattopardo', author: 'Giuseppe Tomasi di Lampedusa', genre: 1 },
	{ title: 'Il nome del vento', author: 'Patrick Rothfuss', genre: 5 },
	{ title: 'Io prima di te', author: 'Jojo Moyes', genre: 6 }
];

let sql: postgres.Sql;

async function register(page: Page, email: string) {
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=displayName]', 'Esplora Test');
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', PASSWORD);
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/auth/login');
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', password);
	await page.getByRole('button', { name: /accedi/i }).click();
	await page.waitForURL('**/library');
}

test.beforeAll(() => {
	sql = postgres(ADMIN_URL, { max: 2, onnotice: () => {} });
});

test.afterAll(async () => {
	await sql.end({ timeout: 2 });
});

test.describe('Ruota della Fortuna', () => {
	const email = `explore-${randomUUID().slice(0, 8)}@test.local`;
	let userId = '';
	const ids: string[] = [];

	test.afterAll(async () => {
		if (userId) await sql`delete from app.users where id = ${userId}::uuid`;
	});

	test('stato vuoto, poi gira, gira ancora, filtri e soft-limit', async ({ page }) => {
		test.setTimeout(90_000);
		await register(page, email);
		const [user] = await sql<
			{ id: string }[]
		>`select id::text from app.users where email = ${email}`;
		userId = user?.id ?? '';
		expect(userId).not.toBe('');

		// Nessun libro non letto: stato vuoto in italiano
		await page.goto('/explore');
		await expect(page.getByRole('heading', { name: 'Esplora', level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Nessun libro da estrarre' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Gira la ruota' })).toHaveCount(0);

		// Fixture: 5 libri non letti, i 3 classici gia nei prossimi
		for (const [i, b] of BOOKS.entries()) {
			const [row] = await sql<{ id: string }[]>`
				insert into public.user_books (user_id, genre_id, title, author_display, page_count, language, format, source)
				values (${userId}::uuid, ${b.genre}, ${b.title}, ${b.author}, ${200 + i}, 'it', 'physical', 'manual')
				returning id::text`;
			ids.push(row?.id ?? '');
		}
		for (const [i, id] of ids.slice(0, 3).entries()) {
			await sql`insert into public.reading_queue (user_id, user_book_id, position)
				values (${userId}::uuid, ${id}::uuid, ${i + 1})`;
		}

		// Ruota con animazione: il puntatore cade sullo spicchio del libro estratto
		await page.goto('/explore');
		await page.waitForLoadState('networkidle');
		const wheel = page.getByRole('img', { name: /Ruota della Fortuna con 5 libri da leggere/ });
		await expect(wheel).toBeVisible();
		await page.getByRole('button', { name: 'Gira la ruota' }).click();
		await expect(page.getByRole('button', { name: 'Gira la ruota' })).toBeDisabled();
		await expect(page.getByText('La sorte ha scelto').first()).toBeVisible({ timeout: 15_000 });

		const title = await page.locator('.result .result-title').innerText();
		expect(BOOKS.map((b) => b.title)).toContain(title);
		const style = (await page.locator('g.spin').getAttribute('style')) ?? '';
		const rotation = Number(/rotate\((-?[\d.]+)deg\)/.exec(style)?.[1]);
		const labels = await page
			.locator('g.spin text')
			.evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
		expect(labels).toHaveLength(5);
		expect(labels[sliceIndexAtPointer(rotation, labels.length)]).toBe(shortTitle(title));

		// Tocco sulla card: dettaglio del libro
		await expect(page.locator('.result')).toHaveAttribute('href', /^\/book\/[0-9a-f-]{36}$/);

		// Gira ancora
		await page.getByRole('button', { name: 'Gira ancora' }).click();
		await expect(page.getByRole('button', { name: 'Gira ancora' })).toBeEnabled({
			timeout: 15_000
		});
		await expect(page.locator('.result .result-title')).toBeVisible();

		// Filtro genere: solo Romance -> un solo libro
		await page.getByRole('button', { name: /^Romance/ }).click();
		await expect(page.getByRole('button', { name: /^Romance/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('button', { name: 'Tutti i non letti' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.getByRole('button', { name: 'Gira la ruota' }).click();
		await expect(page.locator('.result .result-title')).toHaveText('Io prima di te');

		// Metti nei prossimi: soft-limit con conferma
		await page.getByRole('button', { name: 'Metti nei prossimi' }).click();
		const dialog = page.getByRole('alertdialog');
		await expect(dialog).toContainText('Hai già 3 libri nelle prossime letture');
		await dialog.getByRole('button', { name: 'Aggiungi comunque' }).click();
		await expect(page.getByText(/Aggiunto ai prossimi/)).toBeVisible();
		const [queued] = await sql<{ n: number }[]>`
			select count(*)::int as n from public.reading_queue where user_id = ${userId}::uuid`;
		expect(queued?.n).toBe(4);

		// Filtro senza risultati: Thriller non ha libri
		await page.getByRole('button', { name: /^Thriller/ }).click();
		await page.getByRole('button', { name: /^Romance/ }).click();
		await expect(
			page.getByRole('heading', { name: 'Nessun libro in questi generi' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Mostra tutti i non letti' }).click();
		await expect(page.getByRole('button', { name: 'Gira la ruota' })).toBeVisible();
	});
});

test.describe('Calendario annuale (utente demo, sola lettura)', () => {
	test('giorni multi-genere, dettaglio, cambio anno', async ({ page }) => {
		await login(page, 'demo@segnalibro.local', 'segnalibro-demo');
		await page.goto('/explore');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'Calendario 2026' })).toBeVisible();
		await expect(page.getByText('Un pallino per ogni giorno di lettura.')).toBeVisible();
		await expect(
			page.getByRole('list', { name: 'Legenda dei generi' }).getByRole('listitem')
		).toHaveCount(7);
		await expect(page.locator('section.month')).toHaveCount(12);

		// Due generi: meta e meta, etichetta accessibile
		const two = page.getByRole('button', { name: '18 gennaio: Thriller, Fantasy' });
		await expect(two).toBeVisible();
		expect(await two.evaluate((el) => el.style.background)).toContain('linear-gradient');

		// Tre generi: conic-gradient
		const three = page.getByRole('button', { name: /^11 agosto: .+, .+, .+/ });
		await expect(three).toBeVisible();
		expect(await three.evaluate((el) => el.style.background)).toContain('conic-gradient');

		// Dettaglio al tocco: il colore non e l'unico segnale
		await two.click();
		const popover = page.getByRole('note');
		await expect(popover).toContainText('Thriller');
		await expect(popover).toContainText('Fantasy');
		await expect(popover).toContainText('pag.');
		await page.keyboard.press('Escape');
		await expect(popover).toHaveCount(0);

		// Settimana da lunedi e gennaio 2026 inizia di giovedi (3 celle vuote)
		const january = page.getByRole('region', { name: 'Gennaio' });
		await expect(january.locator('.weekdays span')).toHaveText(['L', 'M', 'M', 'G', 'V', 'S', 'D']);
		await expect(january.locator('.blank')).toHaveCount(3);

		// Cambio anno: 2025 non ha letture
		await page.getByRole('button', { name: /Cambia anno/ }).click();
		await page.getByRole('radio', { name: '2025' }).click();
		await expect(page.getByRole('heading', { name: 'Calendario 2025' })).toBeVisible();
		await expect(page.getByText('Nessuna lettura registrata nel 2025.')).toBeVisible();
		await expect(page.getByRole('button', { name: /gennaio:/ })).toHaveCount(0);

		// Ricaricando con ?year la scelta resta
		await page.goto('/explore?year=2025');
		await expect(page.getByRole('heading', { name: 'Calendario 2025' })).toBeVisible();
	});

	test("l'API del calendario valida l'anno", async ({ page }) => {
		await login(page, 'demo@segnalibro.local', 'segnalibro-demo');
		const bad = await page.request.get('/api/explore/calendar?year=abc');
		expect(bad.status()).toBe(422);
		expect(await bad.json()).toMatchObject({ code: 'VALIDATION' });
		const ok = await page.request.get('/api/explore/calendar?year=2026');
		expect(ok.ok()).toBe(true);
		const body = await ok.json();
		expect(body.year).toBe(2026);
		expect(body.days.length).toBeGreaterThan(100);
	});
});
