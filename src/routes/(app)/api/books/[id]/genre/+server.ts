import { json } from '@sveltejs/kit';
import { changeGenreRequestSchema } from '$lib/client/reading-contract';
import { uuidSchema } from '$lib/contracts/primitives';
import { handle, errorResponse, parseBody } from '../../../reading/_http';
import type { RequestHandler } from './$types';

/** Cambia il genere di un libro. `reviewScoresReset` avvisa la UI che i voti specifici sono stati azzerati. */
export const PATCH: RequestHandler = (event) =>
	handle(event, 'library', async (library) => {
		const id = uuidSchema.safeParse(event.params.id);
		if (!id.success) return errorResponse('NOT_FOUND');
		const { genreSlug } = await parseBody(event.request, changeGenreRequestSchema);
		const result = await library.changeGenre({ bookId: id.data, genreSlug });
		return json({
			contractVersion: 1,
			reviewScoresReset: result.reviewScoresReset,
			genreSlug: result.book.genre.slug
		});
	});
