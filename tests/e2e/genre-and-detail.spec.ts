import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';

const ADMIN_URL =
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';
const PASSWORD = 'Dettaglio-e2e-2026!';

/** genre_id: 1 Classici, 2 Mitologia, 3 Distopia, 4 Thriller, 5 Fantasy, 6 Romance, 7 Contemporanea, 8 Saggi */
const BOOK_DEFS = {
	alfa: { title: 'Libro Alfa', genre: 2, pages: 300 },
	beta: { title: 'Libro Beta', genre: 5, pages: 200 },
	gamma: { title: 'Libro Gamma', genre: 1, pages: 400 },
	delta: { title: 'Libro Delta', genre: 3, pages: 250 },
	epsilon: { title: 'Libro Epsilon', genre: 5, pages: 320 },
	zeta: { title: 'Libro Zeta', genre: 4, pages: 180 },
	eta: { title: 'Libro Eta', genre: 6, pages: 280 },
	q1: { title: 'Coda Uno', genre: 7, pages: 100 },
	q2: { title: 'Coda Due', genre: 7, pages: 100 },
	q3: { title: 'Coda Tre', genre: 7, pages: 100 }
} as const;
type BookKey = keyof typeof BOOK_DEFS;

let sql: postgres.Sql;
const email = `b2-${randomUUID().slice(0, 8)}@test.local`;
let userId = '';
const ids = {} as Record<BookKey, string>;

let sessionCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

async function openBook(page: Page, key: BookKey) {
	await page.goto(`/book/${ids[key]}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1, name: BOOK_DEFS[key].title })).toBeVisible();
}

async function pickStatus(page: Page, label: string) {
	await page
		.getByRole('button', { name: /^Stato di lettura:/ })
		.first()
		.click();
	const sheet = page.getByRole('dialog', { name: 'Stato di lettura' });
	await sheet.getByRole('radio', { name: label, exact: true }).click();
	return sheet;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
	sql = postgres(ADMIN_URL, { max: 2, onnotice: () => {} });

	const context = await browser.newContext();
	const page = await context.newPage();
	const baseURL = test.info().project.use.baseURL;
	// In dev la pagina può idratarsi dopo il primo riempimento dei campi: si riprova.
	for (let attempt = 1; ; attempt++) {
		await page.goto(`${baseURL}/auth/register`);
		await page.waitForLoadState('networkidle');
		await page.fill('input[name=displayName]', 'Dettaglio Test');
		await page.fill('input[name=email]', email);
		await page.fill('input[name=password]', PASSWORD);
		await page.getByRole('button', { name: 'Registrati' }).click();
		try {
			await page.waitForURL('**/library', { timeout: 8000 });
			break;
		} catch (error) {
			if (attempt >= 4) throw error;
		}
	}
	sessionCookies = await context.cookies();
	await context.close();

	const [user] = await sql<{ id: string }[]>`select id::text from app.users where email = ${email}`;
	userId = user?.id ?? '';
	expect(userId).not.toBe('');

	for (const [key, def] of Object.entries(BOOK_DEFS) as [BookKey, (typeof BOOK_DEFS)[BookKey]][]) {
		const [row] = await sql<{ id: string }[]>`
			insert into public.user_books (user_id, genre_id, title, author_display, page_count, language, format, source)
			values (${userId}::uuid, ${def.genre}, ${def.title}, 'Autore Test', ${def.pages}, 'it', 'physical', 'manual')
			returning id::text`;
		ids[key] = row?.id ?? '';
	}

	// Epsilon: già letto e recensito (con valutazioni specifiche del genere Fantasy)
	await sql`insert into public.readings (user_id, user_book_id, status, started_at, ended_at, start_page, current_page)
		values (${userId}::uuid, ${ids.epsilon}::uuid, 'completed', now() - interval '20 days', now() - interval '10 days', 0, 320)`;
	await sql.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		await tx`select public.save_review(
			p_book_id => ${ids.epsilon}::uuid,
			p_rating => 4::smallint,
			p_adjectives => ${['Epico', 'Denso', 'Lento']}::text[],
			p_scores => ${tx.json([
				{ dimension_key: 'fantasy.worldbuilding', score: 5 },
				{ dimension_key: 'fantasy.characters', score: 4 }
			])}::jsonb
		)`;
	});

	// Coda piena (3 libri) per il soft-limit
	for (const [i, key] of (['q1', 'q2', 'q3'] as const).entries()) {
		await sql`insert into public.reading_queue (user_id, user_book_id, position)
			values (${userId}::uuid, ${ids[key]}::uuid, ${i + 1})`;
	}
});

test.afterAll(async () => {
	if (userId) await sql`delete from app.users where id = ${userId}::uuid`;
	await sql.end({ timeout: 2 });
});

// La registrazione ha già aperto una sessione: si riusa il cookie (niente login via form a ogni test).
test.beforeEach(async ({ context }) => {
	await context.addCookies(sessionCookies);
});

test('vista genere: sezioni, contatori, ordinamento in URL, slug non valido', async ({ page }) => {
	await page.goto('/genre/mythology-epic-retelling');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitologia, Epica e Retelling');
	await expect(page.getByText('1 libro', { exact: true })).toBeVisible();
	await expect(page.getByText('0 letti', { exact: true })).toBeVisible();
	await expect(page.getByText('1 da leggere')).toBeVisible();
	await expect(page.getByRole('heading', { name: /^Letti/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: /^Da leggere/ })).toBeVisible();
	await expect(page.getByText('per voto, dal più alto')).toBeVisible();
	await expect(page.getByRole('link', { name: /Libro Alfa/ })).toBeVisible();

	// Il chip attivo si inverte al secondo tocco e l'ordine vive nell'URL
	await page.getByRole('link', { name: 'Titolo', exact: true }).click();
	await expect(page).toHaveURL(/sort=title&dir=asc/);
	await expect(page.getByText('per titolo, dalla A alla Z')).toBeVisible();
	await page.getByRole('link', { name: /Titolo/ }).click();
	await expect(page).toHaveURL(/sort=title&dir=desc/);
	await expect(page.getByText('per titolo, dalla Z alla A')).toBeVisible();

	// Slug non valido -> 404
	const response = await page.goto('/genre/non-esiste');
	expect(response?.status()).toBe(404);
});

test('libro non trovato: 404 in italiano', async ({ page }) => {
	const response = await page.goto(`/book/${randomUUID()}`);
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Libro non trovato' })).toBeVisible();
	const bad = await page.goto('/book/non-un-uuid');
	expect(bad?.status()).toBe(404);
});

test('segna come letto dal menu Sposta', async ({ page }) => {
	await openBook(page, 'alfa');
	await expect(page.getByText('Non ancora letto')).toBeVisible();
	await expect(page.getByText('Voto, tag e citazioni si sbloccano')).toBeVisible();

	await page.getByTestId('move-button').click();
	await page.getByRole('button', { name: 'Segna come letto' }).click();
	await page.getByTestId('mark-read-save').click();

	await expect(page.getByTestId('notice')).toContainText('Segnato come letto');
	await expect(page.getByText('Il libro in 3 aggettivi')).toBeVisible();
	await expect(page.getByTestId('reading-history')).toContainText('1ª lettura');

	const [row] = await sql<{ n: number; q: number }[]>`
		select completed_readings_count::int as n,
			(select count(*)::int from public.reading_queue where user_book_id = ${ids.alfa}::uuid) as q
		from public.user_books where id = ${ids.alfa}::uuid`;
	expect(row?.n).toBe(1);
	expect(row?.q).toBe(0);
});

test('avvio, aggiornamento pagina, correzione e fine', async ({ page }) => {
	await openBook(page, 'beta');
	const sheet = await pickStatus(page, 'In lettura');
	await sheet.getByRole('button', { name: 'Salva' }).click();
	await expect(page.getByRole('heading', { name: 'Avanzamento' })).toBeVisible();

	// Avanzamento 0 -> 120
	await page.getByTestId('update-page').click();
	const progress = page.getByRole('dialog', { name: 'Libro Beta' });
	await progress.getByLabel('Pagina raggiunta').fill('120');
	await expect(progress.getByText('120 pagine in più')).toBeVisible();
	await progress.getByRole('button', { name: 'Salva pagina' }).click();
	await expect(page.getByTestId('notice')).toContainText('Pagina aggiornata a 120');
	await expect(page.locator('#progress')).toContainText('p. 120');
	await expect(page.locator('#progress')).toContainText('60%');

	// Correzione 120 -> 100: spiega che corregge il totale
	await page.getByTestId('update-page').click();
	await progress.getByLabel('Pagina raggiunta').fill('100');
	await expect(progress.getByText(/Stai correggendo il totale/)).toBeVisible();
	await progress.getByRole('button', { name: 'Correggi pagina' }).click();
	await expect(page.getByTestId('notice')).toContainText('Pagina corretta');
	await expect(page.locator('#progress')).toContainText('p. 100');

	// Oltre il totale: non valido
	await page.getByTestId('update-page').click();
	await progress.getByLabel('Pagina raggiunta').fill('201');
	await expect(progress.getByText('Il libro ha 200 pagine.')).toBeVisible();
	await expect(progress.getByRole('button', { name: 'Salva pagina' })).toBeDisabled();
	await progress.getByRole('button', { name: 'Annulla' }).click();

	// Ho finito
	await page.locator('#progress').getByRole('button', { name: 'Ho finito' }).click();
	await expect(page.getByText('Il libro in 3 aggettivi')).toBeVisible();
	await expect(page.getByTestId('reading-history')).toContainText('1ª lettura');

	const events = await sql<{ event_type: string; page_delta: number }[]>`
		select event_type, page_delta from public.reading_progress_events
		where user_id = ${userId}::uuid order by occurred_at, created_at`;
	const mine = events.filter((e) => ['progress', 'correction', 'finish'].includes(e.event_type));
	expect(mine.map((e) => e.event_type)).toEqual(['progress', 'correction', 'finish']);
	expect(mine.map((e) => e.page_delta)).toEqual([120, -20, 100]);
});

test('evento idempotente: stesso eventId = nessun doppio conteggio', async ({ page }) => {
	await openBook(page, 'zeta');
	const started = await page.request.post('/api/reading/start', { data: { bookId: ids.zeta } });
	expect(started.ok()).toBe(true);
	const { reading } = await started.json();

	const body = {
		eventId: randomUUID(),
		readingId: reading.id,
		page: 40,
		occurredAt: new Date().toISOString(),
		localDate: new Date().toISOString().slice(0, 10),
		operation: 'progress'
	};
	const first = await page.request.post('/api/reading/event', { data: body });
	const second = await page.request.post('/api/reading/event', { data: body });
	expect(first.status()).toBe(200);
	expect(second.status()).toBe(200);
	expect((await first.json()).duplicate).toBe(false);
	expect((await second.json()).duplicate).toBe(true);

	const [sum] = await sql<{ total: number }[]>`
		select coalesce(sum(page_delta), 0)::int as total from public.reading_progress_events
		where reading_id = ${reading.id}::uuid`;
	expect(sum?.total).toBe(40);

	// Errori mappati per codice: corpo non valido -> VALIDATION 422, lettura sconosciuta -> NOT_FOUND 404
	const invalid = await page.request.post('/api/reading/event', { data: { eventId: 'x' } });
	expect(invalid.status()).toBe(422);
	expect((await invalid.json()).code).toBe('VALIDATION');
	const missing = await page.request.post('/api/reading/event', {
		data: { ...body, eventId: randomUUID(), readingId: randomUUID() }
	});
	expect(missing.status()).toBe(404);
	expect((await missing.json()).code).toBe('NOT_FOUND');
});

test('aggiornamento pagina offline: in coda, poi sincronizzato senza doppioni', async ({
	page,
	context
}) => {
	await openBook(page, 'zeta');
	await expect(page.locator('#progress')).toContainText('p. 40');

	await context.setOffline(true);
	await page.getByTestId('update-page').click();
	const progress = page.getByRole('dialog', { name: 'Libro Zeta' });
	await expect(progress.getByText(/Sei offline/)).toBeVisible();
	await progress.getByLabel('Pagina raggiunta').fill('90');
	await progress.getByRole('button', { name: 'Salva pagina' }).click();
	await expect(page.getByTestId('sync-pending')).toBeVisible();
	await expect(page.locator('#progress')).toContainText('p. 90');

	await context.setOffline(false);
	await expect(page.getByTestId('sync-pending')).toHaveCount(0, { timeout: 20_000 });
	await expect(page.locator('#progress')).toContainText('p. 90');
	const [sum] = await sql<{ total: number }[]>`
		select coalesce(sum(e.page_delta), 0)::int as total
		from public.reading_progress_events e
		join public.readings r on r.id = e.reading_id
		where r.user_book_id = ${ids.zeta}::uuid`;
	expect(sum?.total).toBe(90);
});

test('non finito (DNF) alla pagina scelta', async ({ page }) => {
	await openBook(page, 'gamma');
	const start = await pickStatus(page, 'In lettura');
	await start.getByRole('button', { name: 'Salva' }).click();
	await expect(page.getByRole('heading', { name: 'Avanzamento' })).toBeVisible();

	const sheet = await pickStatus(page, 'Non finito (DNF)');
	await sheet.getByLabel('A che pagina ti sei fermato?').fill('77');
	await sheet.getByRole('button', { name: 'Salva' }).click();

	await expect(page.getByTestId('notice')).toContainText('Stato aggiornato');
	await expect(page.getByTestId('reading-history')).toContainText('Non finito · riposa a p. 77');
	await expect(
		page.getByRole('button', { name: /^Stato di lettura: Non finito/ }).first()
	).toBeVisible();
	const [book] = await sql<{ lifecycle_state: string }[]>`
		select lifecycle_state from public.user_books where id = ${ids.gamma}::uuid`;
	expect(book?.lifecycle_state).toBe('dnf');
});

test('pausa e ripresa', async ({ page }) => {
	await openBook(page, 'delta');
	const start = await pickStatus(page, 'In lettura');
	await start.getByRole('button', { name: 'Salva' }).click();
	await expect(page.getByTestId('update-page')).toBeVisible();

	await page.locator('#progress').getByRole('button', { name: 'In pausa' }).click();
	await expect(page.getByRole('button', { name: 'Riprendi a leggere' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^Stato di lettura: In pausa/ }).first()
	).toBeVisible();

	await page.getByRole('button', { name: 'Riprendi a leggere' }).click();
	await expect(page.getByTestId('update-page')).toBeVisible();
	const [book] = await sql<{ lifecycle_state: string }[]>`
		select lifecycle_state from public.user_books where id = ${ids.delta}::uuid`;
	expect(book?.lifecycle_state).toBe('reading');
});

test('cambio genere di un libro recensito avvisa del reset dei voti specifici', async ({
	page
}) => {
	await openBook(page, 'epsilon');
	await expect(page.getByText('Valutazioni specifiche')).toBeVisible();

	await page.getByRole('button', { name: 'Altre azioni' }).click();
	await page.getByRole('menuitem', { name: 'Sposta il libro' }).click();
	await page.getByRole('button', { name: 'Cambia genere' }).click();
	await page.getByRole('button', { name: /^Mitologia, Epica e Retelling/ }).click();

	await expect(page.getByTestId('notice')).toContainText(
		'valutazioni specifiche sono state azzerate'
	);
	const [book] = await sql<{ genre_id: number; rating: number }[]>`
		select genre_id, review_rating::double precision as rating from public.user_books where id = ${ids.epsilon}::uuid`;
	expect(book?.genre_id).toBe(2);
	expect(book?.rating).toBe(4);
});

test('modifica il formato posseduto dal dettaglio', async ({ page }) => {
	await openBook(page, 'alfa');
	await page.getByRole('button', { name: 'Altre azioni' }).click();
	await page.getByRole('menuitem', { name: 'Modifica formato' }).click();

	const sheet = page.getByRole('dialog', { name: 'Modifica formato' });
	await expect(sheet.getByRole('radio')).toHaveCount(3);
	await sheet.getByRole('radio', { name: 'Entrambi' }).check();
	await sheet.getByRole('button', { name: 'Salva formato' }).click();

	await expect(page.getByTestId('notice')).toContainText('Formato aggiornato.');
	await expect(page.getByText('Entrambi', { exact: true }).first()).toBeVisible();
	const [book] = await sql<{ format: string }[]>`
			select format from public.user_books where id = ${ids.alfa}::uuid`;
	expect(book?.format).toBe('both');
});

test('soft limit della coda dal dettaglio, poi rimozione dai prossimi', async ({ page }) => {
	await openBook(page, 'eta');
	await page.getByTestId('move-button').click();
	await expect(page.getByText('3 su 3')).toBeVisible();
	await page.getByTestId('move-queue').click();

	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toContainText('Hai già 3 libri nelle prossime letture');
	await dialog.getByRole('button', { name: 'Aggiungi comunque' }).click();
	await expect(page.getByTestId('queue-position')).toContainText('4º in coda');

	await page.getByRole('button', { name: 'Altre azioni' }).click();
	await page.getByTestId('menu-queue').click();
	await expect(page.getByTestId('queue-position')).toHaveCount(0);
});

test('rilettura storica con date non crea giorni di lettura', async ({ page }) => {
	await openBook(page, 'epsilon');
	await page.getByRole('button', { name: 'Aggiungi rilettura' }).click();
	const sheet = page.getByRole('dialog', { name: 'Aggiungi rilettura' });
	await sheet.getByRole('radio', { name: "L'ho già riletta" }).click();
	await sheet.getByLabel('Iniziato il').fill('2025-01-10');
	await sheet.getByLabel('Finito il').fill('2025-02-02');
	await sheet.getByRole('button', { name: 'Salva' }).click();

	await expect(page.getByTestId('notice')).toContainText('Rilettura aggiunta');
	await expect(page.getByTestId('reading-history')).toContainText('10 gen 2025 → 2 feb 2025');
	await expect(page.getByTestId('reading-history')).toContainText('Rilettura');

	const [row] = await sql<{ events: number; completed: number }[]>`
		select
			(select count(*)::int from public.reading_progress_events e
				join public.readings r on r.id = e.reading_id
				where r.user_book_id = ${ids.epsilon}::uuid) as events,
			completed_readings_count::int as completed
		from public.user_books where id = ${ids.epsilon}::uuid`;
	expect(row?.events).toBe(0);
	expect(row?.completed).toBe(2);
});
