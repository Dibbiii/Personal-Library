import { expect, test, type Page } from '@playwright/test';

/**
 * Esplora (scoperta libri). Open Library non si raggiunge mai: `/api/discover` e
 * `/api/catalog/info` sono simulati. Utente demo, sola lettura (la conferma si annulla).
 */

const book = (workId: string, title: string, overrides: Record<string, unknown> = {}) => ({
	workId,
	editionId: null,
	title,
	workTitle: title,
	authors: ['Ada Verdi'],
	year: 2001,
	coverUrl: null,
	rating: 4.2,
	ratingCount: 120,
	language: 'it',
	...overrides
});

async function login(page: Page) {
	await page.goto('/auth/login');
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=email]', 'demo@segnalibro.local');
	await page.fill('input[name=password]', 'segnalibro-demo');
	await page.getByRole('button', { name: /accedi/i }).click();
	await page.waitForURL('**/library');
}

test('Esplora: sezioni, ricerca con filtri e aggiunta dal dettaglio', async ({ page }) => {
	const requests: URLSearchParams[] = [];
	await page.route('**/api/discover?*', async (route) => {
		const params = new URL(route.request().url()).searchParams;
		requests.push(params);
		const section = params.get('section') ?? 'search';
		const books =
			section === 'search'
				? [book('OL1W', `Risultato ${params.get('q') ?? ''}`.trim())]
				: [
						book(`OL-${section}-1W`, `Libro ${section} uno`),
						book(`OL-${section}-2W`, `Libro ${section} due`)
					];
		await route.fulfill({ json: { books, total: books.length, hasMore: false } });
	});
	await page.route('**/api/catalog/info*', (route) => route.fulfill({ json: { info: null } }));

	await login(page);
	await page.goto('/explore');
	await expect(page.getByRole('heading', { name: 'Scopri il tuo prossimo libro' })).toBeVisible();

	for (const name of [
		'Consigliati per te',
		'Novità e uscite recenti',
		'Classici da non perdere',
		'I più popolari',
		'Libri in tendenza',
		'Esplora per tema'
	]) {
		await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
	}
	await expect(page.getByRole('button', { name: /Libro classics uno/ })).toBeVisible();
	expect(requests.some((params) => params.get('section') === 'recommended')).toBe(true);

	// Ricerca dal banner, poi un filtro: la griglia dei risultati usa entrambi
	await page.getByRole('searchbox', { name: 'Cerca libri, autori, generi' }).fill('drago');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: 'Risultati per “drago”' })).toBeVisible();
	// Su mobile i filtri stanno dietro al pulsante "Filtri"
	const toggle = page.getByRole('button', { name: /^Filtri/ });
	if (await toggle.isVisible()) await toggle.click();
	await page.getByRole('button', { name: '4 stelle e più' }).click();
	await expect
		.poll(() => requests.some((p) => p.get('q') === 'drago' && p.get('minRating') === '4'))
		.toBe(true);

	// Dettaglio e aggiunta: si passa sempre dalla conferma di genere e formato
	await page.getByRole('button', { name: /^Risultato drago/ }).click();
	const detail = page.getByRole('dialog', { name: 'Risultato drago' });
	await expect(detail).toBeVisible();
	await detail.getByRole('button', { name: 'Aggiungi alla mia libreria' }).click();
	const sheet = page.getByRole('dialog', { name: 'Aggiungi alla libreria' });
	await expect(sheet.getByText('Risultato drago')).toBeVisible();
	await sheet.getByRole('button', { name: 'Annulla' }).click();
	await expect(sheet).toBeHidden();

	// Torna alle sezioni
	await page.getByRole('button', { name: 'Esplora', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Consigliati per te' })).toBeVisible();
});
