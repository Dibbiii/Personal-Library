import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookRemovalResponseSchema } from '../../src/lib/contracts/library-mutations';
import { RpcLibraryRepository } from '../../src/lib/data/example-library-repository';
import type { RpcTransport } from '../../src/lib/data/rpc-client';
import { deleteCover } from '../../src/lib/server/storage';
import { POST } from '../../src/routes/(app)/api/library/remove/+server';

vi.mock('../../src/lib/server/storage', async (importOriginal) => {
	const original = await importOriginal<typeof import('../../src/lib/server/storage')>();
	return { ...original, deleteCover: vi.fn() };
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOOK_ID = '22222222-2222-4222-8222-222222222222';
const READING_ID = '33333333-3333-4333-8333-333333333333';
const COVER_PATH = `covers/${USER_ID}/${BOOK_ID}.webp`;
const publicResult = {
	contractVersion: 1,
	bookId: BOOK_ID,
	readingIds: [READING_ID],
	clearedBingoCells: 2
};
const internalResult = { ...publicResult, coverStoragePath: COVER_PATH };
const rpc = vi.fn<RpcTransport['rpc']>();
const library = new RpcLibraryRepository({ rpc });
const cleanup = vi.mocked(deleteCover);

function event(
	body: unknown = { bookId: BOOK_ID },
	authenticated = true
): Parameters<typeof POST>[0] {
	return {
		request: new Request('http://localhost/api/library/remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			user: authenticated
				? { id: USER_ID, email: 'removal@test.local', displayName: 'Test' }
				: null,
			repos: { library },
			themeKey: 'default'
		}
	} as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
	rpc.mockReset().mockResolvedValue({ data: internalResult, error: null });
	cleanup.mockReset().mockResolvedValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('RpcLibraryRepository.removeBook (senza DB)', () => {
	it('chiama remove_book con il solo id libro e valida il risultato interno', async () => {
		await expect(library.removeBook(BOOK_ID)).resolves.toEqual(internalResult);
		expect(rpc).toHaveBeenCalledExactlyOnceWith('remove_book', { p_book_id: BOOK_ID });
		expect(cleanup).not.toHaveBeenCalled();
	});

	it.each([
		{ ...internalResult, contractVersion: 2 },
		{ ...internalResult, readingIds: ['invalid'] },
		{ ...internalResult, clearedBingoCells: -1 },
		publicResult
	])('rifiuta una risposta RPC fuori contratto: %j', async (data) => {
		rpc.mockResolvedValue({ data, error: null });
		await expect(library.removeBook(BOOK_ID)).rejects.toMatchObject({ code: 'CONTRACT' });
	});

	it('normalizza NOT_FOUND SQL senza nascondere il codice', async () => {
		rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'Book not found' } });
		await expect(library.removeBook(BOOK_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('POST /api/library/remove (repository e storage mockati)', () => {
	it('restituisce il contratto pubblico no-store e pulisce la cover dell’utente di sessione', async () => {
		const response = await POST(event());
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('content-type')).toContain('application/json');
		const payload: unknown = await response.json();
		expect(payload).toEqual(publicResult);
		expect(payload).not.toHaveProperty('coverStoragePath');
		expect(bookRemovalResponseSchema.parse(payload)).toEqual(publicResult);
		expect(rpc).toHaveBeenCalledExactlyOnceWith('remove_book', { p_book_id: BOOK_ID });
		expect(cleanup).toHaveBeenCalledExactlyOnceWith(COVER_PATH, USER_ID);
	});

	it('non avvia la pulizia finché la mutazione RPC non è confermata', async () => {
		let resolveRpc!: (result: Awaited<ReturnType<RpcTransport['rpc']>>) => void;
		rpc.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveRpc = resolve;
				})
		);
		const responsePromise = POST(event());
		await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
		expect(cleanup).not.toHaveBeenCalled();
		resolveRpc({ data: internalResult, error: null });
		expect((await responsePromise).status).toBe(200);
		expect(cleanup).toHaveBeenCalledExactlyOnceWith(COVER_PATH, USER_ID);
	});

	it('senza cover non chiama lo storage', async () => {
		rpc.mockResolvedValue({ data: { ...internalResult, coverStoragePath: null }, error: null });
		const response = await POST(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(publicResult);
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('un errore filesystem dopo commit non annulla la rimozione né espone il percorso', async () => {
		const cause = new Error('filesystem unavailable');
		cleanup.mockRejectedValue(cause);
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await POST(event());
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual(publicResult);
		expect(rpc).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining('Pulizia cover'),
			expect.objectContaining({
				userId: USER_ID,
				bookId: BOOK_ID,
				coverStoragePath: COVER_PATH,
				cause
			})
		);
	});

	it('senza sessione rifiuta prima del repository, anche se presente nei locals', async () => {
		const response = await POST(event({ bookId: BOOK_ID }, false));
		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({ code: 'AUTH_REQUIRED', message: expect.any(String) });
		expect(rpc).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('senza repository autenticato fallisce senza chiamare RPC o storage', async () => {
		const requestEvent = event();
		requestEvent.locals.repos = null;
		const response = await POST(requestEvent);
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
		expect(rpc).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it.each([
		{},
		{ bookId: 'invalid' },
		{ bookId: BOOK_ID, userId: READING_ID },
		{ bookId: BOOK_ID, coverStoragePath: COVER_PATH }
	])('rifiuta input non valido/contraffatto: %j', async (body) => {
		const response = await POST(event(body));
		expect(response.status).toBe(422);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toMatchObject({
			code: 'VALIDATION',
			message: expect.any(String)
		});
		expect(rpc).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it.each([
		['NOT_FOUND', 404],
		['AUTH_REQUIRED', 401],
		['CONFLICT', 409],
		['SERVER', 500]
	] as const)(
		'errore %s: nessuna pulizia e risposta standard %i no-store',
		async (dataCode, status) => {
			rpc.mockResolvedValue({
				data: null,
				error: { dataCode, message: `private database detail ${COVER_PATH}` }
			});
			const response = await POST(event());
			expect(response.status).toBe(status);
			expect(response.headers.get('cache-control')).toBe('private, no-store');
			const payload: unknown = await response.json();
			expect(payload).toEqual({ code: dataCode, message: expect.any(String) });
			expect(JSON.stringify(payload)).not.toContain(COVER_PATH);
			expect(cleanup).not.toHaveBeenCalled();
		}
	);

	it('non-owner/seconda rimozione NOT_FOUND non pulisce mai una cover', async () => {
		rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'Book not found' } });
		const response = await POST(event());
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('risposta RPC malformata: CONTRACT 502 prima di ogni pulizia', async () => {
		rpc.mockResolvedValue({ data: { ...internalResult, clearedBingoCells: 0.5 }, error: null });
		const response = await POST(event());
		expect(response.status).toBe(502);
		expect(await response.json()).toMatchObject({ code: 'CONTRACT' });
		expect(cleanup).not.toHaveBeenCalled();
	});
});
