import { quoteSchema, reviewSchema, type Quote, type Review } from '$lib/contracts/reviews';
import { z } from 'zod';
import type { SaveReviewRequest } from '$lib/review';

/** Errore di una chiamata a /api/review o /api/quotes. `offline` = la richiesta non è partita. */
export class ReviewApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string,
		readonly offline = false
	) {
		super(message);
		this.name = 'ReviewApiError';
	}
}

const errorBodySchema = z.object({ code: z.string(), message: z.string() });
const saveResponseSchema = z.object({ review: reviewSchema });
const quoteResponseSchema = z.object({ quote: quoteSchema });

async function call(url: string, init: RequestInit): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			headers: { 'content-type': 'application/json', accept: 'application/json' }
		});
	} catch {
		throw new ReviewApiError(
			'Sei offline: riproverò appena torna la connessione.',
			0,
			'NETWORK',
			true
		);
	}

	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		// corpo vuoto o non JSON
	}

	if (!response.ok) {
		const parsed = errorBodySchema.safeParse(body);
		throw new ReviewApiError(
			parsed.success ? parsed.data.message : 'Qualcosa è andato storto. Riprova.',
			response.status,
			parsed.success ? parsed.data.code : 'SERVER',
			response.status === 503 || response.status === 502
		);
	}
	return body;
}

export async function saveReviewRequest(
	request: SaveReviewRequest,
	options: { keepalive?: boolean } = {}
): Promise<Review> {
	const body = await call('/api/review', {
		method: 'PUT',
		body: JSON.stringify(request),
		keepalive: options.keepalive ?? false
	});
	return saveResponseSchema.parse(body).review;
}

export async function addQuoteRequest(input: {
	bookId: string;
	body: string;
	page: number | null;
}): Promise<Quote> {
	const body = await call('/api/quotes', { method: 'POST', body: JSON.stringify(input) });
	return quoteResponseSchema.parse(body).quote;
}

export async function updateQuoteRequest(
	quoteId: string,
	input: { body: string; page: number | null }
): Promise<Quote> {
	const body = await call(`/api/quotes/${quoteId}`, {
		method: 'PATCH',
		body: JSON.stringify(input)
	});
	return quoteResponseSchema.parse(body).quote;
}

export async function deleteQuoteRequest(quoteId: string): Promise<void> {
	await call(`/api/quotes/${quoteId}`, { method: 'DELETE' });
}
