/**
 * Chiamate del browser agli endpoint `/api/catalog`, `/api/library/add` e `/api/covers`.
 * Nessun provider esterno è raggiunto da qui. Le risposte sono validate con Zod.
 */
import type { z } from 'zod';
import type { DataErrorCode } from '$lib/data/errors';
import type { BookSearchRequest } from '$lib/contracts/rpc';
import { editionsResponseSchema } from './editions';
import { bookInfoResponseSchema, type BookInfo } from './book-info';
import { discoverResponseSchema, type DiscoverRequest, type DiscoverResponse } from './discover';
import {
	addBookResponseSchema,
	apiErrorSchema,
	catalogSearchResponseSchema,
	coverAlternativesResponseSchema,
	coverChangedResponseSchema,
	isbnLookupResponseSchema,
	updateBookResponseSchema,
	type AddBookRequest,
	type AddBookResponse,
	type CatalogSearchResponse,
	type CoverSelectRequest,
	type IsbnLookupResponse,
	type UpdateBookRequest,
	type UpdateBookResponse
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
	params: BookSearchRequest,
	signal?: AbortSignal
): Promise<CatalogSearchResponse> {
	const query = new URLSearchParams({ title: params.title });
	if (params.author) query.set('author', params.author);
	if (params.language) query.set('language', params.language);
	if (params.sort) query.set('sort', params.sort);
	if (params.source) query.set('source', params.source);
	return request(catalogSearchResponseSchema, `/api/catalog/search?${query}`, { signal });
}

export function lookupIsbn(isbn: string, signal?: AbortSignal): Promise<IsbnLookupResponse> {
	return request(isbnLookupResponseSchema, `/api/catalog/isbn?${new URLSearchParams({ isbn })}`, {
		signal
	});
}

export function fetchEditions(workId: string, offset: number, signal?: AbortSignal) {
	return request(
		editionsResponseSchema,
		`/api/catalog/editions?${new URLSearchParams({ workId, offset: String(offset) })}`,
		{ signal }
	);
}

/** Descrizione, voto, temi ed edizioni da Open Library; null se il libro non si trova. */
export async function fetchBookInfo(
	params: { title: string; author: string; language?: string | null },
	signal?: AbortSignal
): Promise<BookInfo | null> {
	const query = new URLSearchParams({ title: params.title, author: params.author });
	if (params.language) query.set('language', params.language);
	const response = await request(bookInfoResponseSchema, `/api/catalog/info?${query}`, { signal });
	return response.info;
}

/** Libri da scoprire per Esplora: sezioni, ricerca e filtri. */
export function discoverBooks(
	query: DiscoverRequest,
	signal?: AbortSignal
): Promise<DiscoverResponse> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === '' || value === null) continue;
		if (typeof value === 'boolean') params.set(key, value ? '1' : '0');
		else params.set(key, Array.isArray(value) ? value.join(',') : String(value));
	}
	return request(discoverResponseSchema, `/api/discover?${params}`, { signal });
}

export function addBookToLibrary(input: AddBookRequest): Promise<AddBookResponse> {
	return request(addBookResponseSchema, '/api/library/add', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
}

export function updateBookInLibrary(
	bookId: string,
	input: UpdateBookRequest
): Promise<UpdateBookResponse> {
	return request(updateBookResponseSchema, `/api/books/${encodeURIComponent(bookId)}`, {
		method: 'PATCH',
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
