import { expect, test } from '@playwright/test';

test('le route protette rimandano al login', async ({ page }) => {
	await page.goto('/library');
	await expect(page).toHaveURL(/\/auth\/login\?next=%2Flibrary/);
	await expect(page.getByRole('heading', { name: 'Bentornato' })).toBeVisible();
});

test('il tema è applicato prima dell’idratazione', async ({ page }) => {
	await page.goto('/auth/login');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'segnalibro');
	const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(background).not.toBe('rgba(0, 0, 0, 0)');
});

test('la pagina di registrazione valida i campi lato server', async ({ page }) => {
	await page.goto('/auth/register');
	await page.getByRole('button', { name: 'Registrati' }).click();
	await expect(page.getByText('Come ti chiami?')).toBeVisible();
});

test('il manifest PWA espone nome e colori del tema', async ({ request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest.name).toBe('Segnalibro');
	expect(manifest.display).toBe('standalone');
	expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});
