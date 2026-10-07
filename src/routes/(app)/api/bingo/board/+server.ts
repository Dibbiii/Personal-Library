import { json } from '@sveltejs/kit';
import {
	bingoBoardSchema,
	createBingoBoardInputSchema,
	updateBingoBoardInputSchema
} from '$lib/contracts';
import { handle, parseBody } from '../../stats/_http';
import type { RequestHandler } from './$types';

/** Crea la card Bingo di un anno (16 sfide di default). 409 se esiste già. */
export const POST: RequestHandler = (event) =>
	handle(event, 'bingo', async (bingo) => {
		const { year } = await parseBody(event.request, createBingoBoardInputSchema);
		const board = await bingo.createBoard(year);
		return json(bingoBoardSchema.parse(board), { status: 201 });
	});

export const PATCH: RequestHandler = (event) =>
handle(event, 'bingo', async (bingo) => {
	const input = await parseBody(event.request, updateBingoBoardInputSchema);
	const board = await bingo.updateBoard(input);
	return json(bingoBoardSchema.parse(board));
});

export const DELETE: RequestHandler = (event) =>
handle(event, 'bingo', async (bingo) => {
	const { year } = await parseBody(event.request, createBingoBoardInputSchema);
	await bingo.deleteBoard(year);
	return json({ ok: true });
});
