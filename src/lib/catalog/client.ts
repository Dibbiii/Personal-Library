/**
 * Chiamate del browser agli endpoint `/api/catalog`, `/api/library/add` e `/api/covers`.
 * Nessun provider esterno è raggiunto da qui. Le risposte sono validate con Zod.
 */
import type { z } from 'zod';
import type { DataErrorCode } from '$lib/data/errors';
import {
	addBookResponseSchema,
	apiErrorSchema,
	catalogSearchResponseSchema,
	coverAlternativesResponseSchema,
	coverChangedResponseSchema,
	isbnLookupResponseSchema,
	type AddBookRequest,
	type AddBookResponse,
	type CatalogSearchResponse,
	type CoverSelectRequest,
	type IsbnLookupResponse
} from './schemas';

export class CatalogClientError extends Error {
	constructor(
		readonly code: DataErrorCode,
		message: string,
		readonly status: number,
		readonly field?: string
	) {
		super(message);
		this.name = 'CatalogClientError';
	}
}

const OFFLINE_MESSAGE = 'Sei offline o il server non risponde. Controlla la connessione e riprova.';

async function request<S extends z.ZodType>(
	schema: S,
	url: string,
	init: Omit<RequestInit, 'signal'> & { signal?: AbortSignal | undefined } = {}
): Promise<z.output<S>> {
	const { signal, ...rest } = init;
	let response: Response;
	try {
		response = await fetch(url, {
			credentials: 'same-origin',
			...rest,
			...(signal ? { signal } : {})
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		throw new CatalogClientError('NETWORK', OFFLINE_MESSAGE, 0);
	}

	let payload: unknown = null;
	try {
		payload = await response.json();
	} catch {
		// corpo vuoto o non JSON
	}

	if (!response.ok) {
		const parsed = apiErrorSchema.safeParse(payload);
		if (parsed.success) {
			throw new CatalogClientError(
				parsed.data.code,
				parsed.data.message,
				response.status,
				parsed.data.field
			);
		}
		throw new CatalogClientError('SERVER', 'Qualcosa è andato storto, riprova.', response.status);
	}

	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		throw new CatalogClientError('CONTRACT', 'Risposta inattesa dal server.', response.status);
	}
	return parsed.data;
}

export function searchBooks(
	params: { title: string; author?: string; language?: string },
	signal?: AbortSignal
): Promise<CatalogSearchResponse> {
	const query = new URLSearchParams({ title: params.title });
	if (params.author) query.set('author', params.author);
	if (params.language) query.set('language', params.language);
	return request(catalogSearchResponseSchema, `/api/catalog/search?${query}`, { signal });
}

export function lookupIsbn(isbn: string, signal?: AbortSignal): Promise<IsbnLookupResponse> {
	return request(isbnLookupResponseSchema, `/api/catalog/isbn?${new URLSearchParams({ isbn })}`, {
		signal
	});
}

export function addBookToLibrary(input: AddBookRequest): Promise<AddBookResponse> {
	return request(addBookResponseSchema, '/api/library/add', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
}

export function fetchCoverAlternatives(bookId: string, signal?: AbortSignal) {
	return request(
		coverAlternativesResponseSchema,
		`/api/covers/alternatives?${new URLSearchParams({ bookId })}`,
		{ signal }
	);
}

export function selectCover(input: CoverSelectRequest) {
	return request(coverChangedResponseSchema, '/api/covers/select', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
}

export function uploadCover(bookId: string, file: File) {
	const form = new FormData();
	form.set('bookId', bookId);
	form.set('file', file);
	return request(coverChangedResponseSchema, '/api/covers/upload', { method: 'POST', body: form });
}
