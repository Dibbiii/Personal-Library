import { json } from '@sveltejs/kit';
import { bingoAssignInputSchema, bingoBoardSchema } from '$lib/contracts';
import { handle, parseBody } from '../../stats/_http';
import type { RequestHandler } from './$types';

/** Assegna un libro letto a una casella del Bingo (`bookId: null` svuota la casella). */
export const POST: RequestHandler = (event) =>
	handle(event, 'bingo', async (bingo) => {
		const input = await parseBody(event.request, bingoAssignInputSchema);
		const board = await bingo.assignBook(input);
		return json(bingoBoardSchema.parse(board));
	});
