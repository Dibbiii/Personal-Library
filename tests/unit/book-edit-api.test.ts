import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateBook } = vi.hoisted(() => ({ updateBook: vi.fn() }));

vi.mock('../../src/lib/server/catalog/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/catalog/api')>();
	return {
		...actual,
		getCatalogRepository: vi.fn(() => ({ updateBook }))
	};
});

import { PATCH } from '../../src/routes/(app)/api/books/[id]/+server';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOOK_ID = '22222222-2222-4222-8222-222222222222';
const requestBody = {
	genre: 'dystopia-scifi',
	format: 'digital',
	series: null
};

function event(
	body: unknown = requestBody,
	authenticated = true,
	id = BOOK_ID
): Parameters<typeof PATCH>[0] {
	return {
		request: new Request(`http://localhost/api/books/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		params: { id },
		locals: {
			user: authenticated
				? { id: USER_ID, email: 'book-edit@test.local', displayName: 'Test' }
				: null,
			repos: {},
			themeKey: 'default'
		}
	} as unknown as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
	updateBook.mockReset().mockResolvedValue({
		status: 'updated',
		bookId: BOOK_ID,
		reviewScoresReset: false
	});
});

describe('PATCH /api/books/[id]', () => {
	it('usa l’identità di sessione e aggiorna il libro richiesto', async () => {
		const response = await PATCH(event());

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			status: 'updated',
			bookId: BOOK_ID,
			reviewScoresReset: false
		});
		expect(updateBook).toHaveBeenCalledExactlyOnceWith(USER_ID, BOOK_ID, requestBody);
	});

	it('non accetta modifiche anonime', async () => {
		const response = await PATCH(event(requestBody, false));

		expect(response.status).toBe(401);
		expect(updateBook).not.toHaveBeenCalled();
	});

	it('rifiuta campi di identità inseriti nel payload', async () => {
		const response = await PATCH(event({ ...requestBody, userId: USER_ID }));

		expect(response.status).toBe(422);
		expect(updateBook).not.toHaveBeenCalled();
	});

	it('segnala un’edizione già presente senza sostituire il libro', async () => {
		updateBook.mockResolvedValue({
			status: 'duplicate',
			exact: true,
			existing: { id: BOOK_ID, title: 'Dune', author: 'Frank Herbert' }
		});
		const response = await PATCH(event());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: 'duplicate',
			exact: true,
			existing: { id: BOOK_ID, title: 'Dune', author: 'Frank Herbert' }
		});
	});
});
