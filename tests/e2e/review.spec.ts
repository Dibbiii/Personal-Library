import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/**
 * Flusso recensione sul banco di prova `/dev/review` (esiste solo con `vite dev`: se la route
 * risponde 404, cioè su una build di produzione, i test vengono saltati).
 * Crea un utente nuovo per ogni test e lo elimina alla fine: il demo non viene toccato.
 * Serve il DB locale (`docker compose up -d db`) con le migration applicate (fino alla 103).
 */
const ADMIN_URL =
	process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro';

const admin = postgres(ADMIN_URL, { max: 2, onnotice: () => {} });

test.afterAll(async () => {
	await admin.end({ timeout: 2 });
});

interface Fixture {
	userId: string;
	email: string;
	bookId: string;
}

async function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
	return (await admin.begin(async (tx) => {
		await tx`select set_config('app.user_id', ${userId}, true)`;
		return run(tx);
	})) as T;
}

async function registerWithBook(page: Page): Promise<Fixture> {
	const email = `b3-${randomUUID().slice(0, 8)}@test.local`;
	await page.goto('/auth/register');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Nome').fill('Prova Recensione');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('prova-recensione-1');
	await page.getByRole('button', { name: 'Registrati' }).click();
	await page.waitForURL('**/library');

	const [user] = await admin<{ id: string }[]>`select id from app.users where email = ${email}`;
	const userId = user!.id;
	const bookId = randomUUID();
	await admin`
		insert into public.user_books (
			id, user_id, genre_id, title, author_display, page_count, language, format, source
		) values (
			${bookId}::uuid, ${userId}::uuid, 5, 'Il nome del vento', 'Patrick Rothfuss', 662,
			'it', 'physical', 'manual'
		)
	`;
	return { userId, email, bookId };
}

async function finishReading(f: Fixture) {
	await asUser(
		f.userId,
		(tx) => tx`
		select public.add_completed_reading(
			${f.bookId}::uuid, '2026-01-03T20:00:00+00:00'::timestamptz,
			'2026-01-18T20:00:00+00:00'::timestamptz, 662, 0
		)
	`
	);
}

async function open(page: Page, f: Fixture) {
	const response = await page.goto(`/dev/review?book=${f.bookId}`);
	test.skip(response?.status() === 404, '/dev/review esiste solo con vite dev');
	await expect(
		page.locator('[data-testid=review-panel], [data-testid=review-locked]')
	).toBeVisible();
	// evita di interagire prima dell'idratazione (gli handler non sono ancora collegati)
	await page.waitForLoadState('networkidle');
}

async function reload(page: Page) {
	await page.reload();
	await page.waitForLoadState('networkidle');
}

const status = (page: Page) => page.getByTestId('review-save-status');
const saved = (page: Page) => expect(status(page)).toHaveAttribute('data-state', 'saved');

/** Seleziona un tag; se è nascosto dalla vista ridotta apre "Mostra tutti i tag". */
async function pickTag(page: Page, label: string) {
	const tag = page.getByRole('button', { name: label, exact: true });
	if ((await tag.count()) === 0)
		await page.getByRole('button', { name: /Mostra tutti i tag/ }).click();
	await tag.click();
}

async function addAdjective(page: Page, text: string) {
	const input = page.getByLabel('Aggiungi un aggettivo');
	await input.fill(text);
	await input.press('Enter');
}

test.describe('Recensione', () => {
	test.describe.configure({ mode: 'serial', timeout: 90_000, retries: 1 });

	let fixture: Fixture;

	test.afterEach(async () => {
		if (fixture) await admin`delete from app.users where id = ${fixture.userId}::uuid`;
	});

	test('bloccata senza lettura completata, si sblocca dopo il "letto"', async ({ page }) => {
		fixture = await registerWithBook(page);
		await open(page, fixture);

		const locked = page.getByTestId('review-locked');
		await expect(locked.getByRole('heading', { name: 'Recensione' })).toBeVisible();
		await expect(locked.getByText('Non ancora letto')).toBeVisible();
		await expect(
			locked.getByText('Voto, tag e citazioni si sbloccano quando segni il libro come letto.')
		).toBeVisible();
		await expect(locked.getByRole('button', { name: 'Sposta' })).toBeVisible(); // lockedFooter
		await expect(page.getByLabel('Aggiungi un aggettivo')).toHaveCount(0);

		await finishReading(fixture);
		await reload(page);
		await expect(page.getByTestId('review-panel')).toBeVisible();
		await expect(page.getByTestId('review-locked')).toHaveCount(0);
		await expect(page.getByText('Date di lettura')).toBeVisible(); // afterScores
	});

	test('aggettivi facoltativi, voto, rating per genere, tag e persistenza', async ({ page }) => {
		fixture = await registerWithBook(page);
		await finishReading(fixture);
		await open(page, fixture);
		const panel = page.getByTestId('review-panel');

		await expect(panel.getByText('Facoltativi: puoi aggiungerne fino a 3, tutti distinti.')).toBeVisible();

		// Con il solo voto la recensione si salva anche senza aggettivi.
		await panel.getByRole('radio', { name: '4 stelle' }).first().click();
		await saved(page);
		let [row] = await admin<{ adjectives: string[] }[]>`
			select adjectives from public.reviews where user_book_id = ${fixture.bookId}::uuid`;
		expect(row?.adjectives).toEqual([]);

		await addAdjective(page, 'epico');
		await saved(page);
		[row] = await admin<{ adjectives: string[] }[]>`
			select adjectives from public.reviews where user_book_id = ${fixture.bookId}::uuid`;
		expect(row?.adjectives).toEqual(['Epico']);
		await addAdjective(page, 'EPICO');
		await expect(panel.getByRole('alert')).toHaveText('Hai già usato questo aggettivo.');

		await addAdjective(page, 'malinconico');
		await expect(panel.getByText('2/3')).toBeVisible();
		await saved(page);
		[row] = await admin<{ adjectives: string[] }[]>`
			select adjectives from public.reviews where user_book_id = ${fixture.bookId}::uuid`;
		expect(row?.adjectives).toEqual(['Epico', 'Malinconico']);

		await addAdjective(page, 'immersivo');
		await expect(panel.getByText('3/3')).toBeVisible();
		await saved(page);

		// rating specifici del genere Fantasy, etichetta breve del mockup
		const dims = ['Worldbuilding', 'Sistema magico', 'Personaggi', 'Ritmo', 'Atmosfera'];
		for (const name of dims) await expect(panel.getByRole('radiogroup', { name })).toBeVisible();
		await panel
			.getByRole('radiogroup', { name: 'Sistema magico' })
			.getByRole('radio', { name: '4 stelle' })
			.click();
		await saved(page);

		// tag: toggle
		await pickTag(page, 'Magia');
		await expect(panel.getByRole('button', { name: 'Magia' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await saved(page);

		// tutto persiste dopo il ricaricamento
		await reload(page);
		const again = page.getByTestId('review-panel');
		await expect(again.getByText('3/3')).toBeVisible();
		for (const a of ['Epico', 'Malinconico', 'Immersivo'])
			await expect(again.getByRole('button', { name: `Rimuovi ${a}` })).toBeVisible();
		await expect(again.getByText('4/5')).toBeVisible();
		await expect(
			again
				.getByRole('radiogroup', { name: 'Sistema magico' })
				.getByRole('radio', { name: '4 stelle' })
		).toHaveAttribute('aria-checked', 'true');
		await expect(again.getByRole('button', { name: 'Magia' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		// Anche togliendo un aggettivo la recensione resta salvabile.
		await again.getByRole('button', { name: 'Rimuovi Epico' }).click();
		await saved(page);
		await expect(again.getByText('4/5')).toBeVisible();
		await expect(again.getByRole('button', { name: 'Magia' })).toHaveAttribute('aria-pressed', 'true');
		const [savedRow] = await admin<{ adjectives: string[] }[]>`
			select adjectives from public.reviews where user_book_id = ${fixture.bookId}::uuid`;
		expect(savedRow?.adjectives).toEqual(['Malinconico', 'Immersivo']);
	});

	test('citazioni: aggiungi, modifica, elimina', async ({ page }) => {
		fixture = await registerWithBook(page);
		await finishReading(fixture);
		await open(page, fixture);
		const panel = page.getByTestId('review-panel');

		await panel.getByRole('button', { name: 'Aggiungi citazione' }).click();
		await panel.getByLabel('Testo della citazione').fill('«Certe storie si leggono due volte.»');
		await panel.getByLabel('Pagina (facoltativa)').fill('48');
		await panel.getByRole('button', { name: 'Salva' }).click();

		const item = panel.getByTestId('quote-item');
		await expect(item).toHaveCount(1);
		await expect(item).toContainText('«Certe storie si leggono due volte.»');
		await expect(item.getByText('p. 48')).toBeVisible();

		await item.getByRole('button', { name: 'Modifica citazione' }).click();
		await panel.getByLabel('Testo della citazione').fill('Testo corretto');
		await panel.getByLabel('Pagina (facoltativa)').fill('');
		await panel.getByRole('button', { name: 'Salva' }).click();
		await expect(item).toContainText('«Testo corretto»');
		await expect(panel.getByText('p. 48')).toHaveCount(0);

		await reload(page);
		await expect(page.getByTestId('quote-item')).toContainText('Testo corretto');

		await page.getByRole('button', { name: 'Elimina citazione' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click();
		await expect(page.getByTestId('quote-item')).toHaveCount(0);
		await reload(page);
		await expect(page.getByTestId('quote-item')).toHaveCount(0);
	});

	test('cambio genere: rating specifici azzerati, resto mantenuto; sbloccata anche in rilettura', async ({
		page
	}) => {
		fixture = await registerWithBook(page);
		await finishReading(fixture);
		await open(page, fixture);
		const panel = page.getByTestId('review-panel');

		for (const a of ['Epico', 'Malinconico', 'Immersivo']) await addAdjective(page, a);
		await panel.getByRole('radio', { name: '5 stelle' }).first().click(); // voto generale
		await panel
			.getByRole('radiogroup', { name: 'Ritmo' })
			.getByRole('radio', { name: '3 stelle' })
			.click();
		await pickTag(page, 'Magia');
		await panel.getByRole('button', { name: 'Aggiungi citazione' }).click();
		await panel.getByLabel('Testo della citazione').fill('Una frase');
		await panel.getByRole('button', { name: 'Salva' }).click();
		await expect(page.getByTestId('quote-item')).toHaveCount(1);
		await saved(page);

		await page.getByTestId('dev-genre').selectOption('thriller-mystery');
		await expect(page.getByTestId('review-scores-reset')).toBeVisible();
		await expect(page.getByRole('radiogroup', { name: 'Tensione' })).toBeVisible();
		await expect(
			page.getByRole('radiogroup', { name: 'Ritmo' }).getByRole('radio', { checked: true })
		).toHaveCount(0);
		await expect(panel.getByText('5/5')).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Rimuovi Epico' })).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Magia' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByTestId('quote-item')).toHaveCount(1);

		const scores =
			await admin`select 1 from public.review_scores where user_id = ${fixture.userId}::uuid`;
		expect(scores).toHaveLength(0);

		// rilettura in corso: lo stato corrente non è "letto" ma la recensione resta aperta
		await asUser(
			fixture.userId,
			(tx) => tx`
			select public.start_reading(${fixture.bookId}::uuid, now(), 0)
		`
		);
		await reload(page);
		await expect(page.getByTestId('review-panel')).toBeVisible();
		await expect(page.getByTestId('review-locked')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Rimuovi Epico' })).toBeVisible();
	});
});
