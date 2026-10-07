import { json } from '@sveltejs/kit';
import { changeFormatRequestSchema } from '$lib/client/reading-contract';
import { uuidSchema } from '$lib/contracts/primitives';
import { handle, errorResponse, parseBody } from '../../../reading/_http';
import type { RequestHandler } from './$types';

/** Cambia il formato posseduto del libro. */
export const PATCH: RequestHandler = (event) =>
	handle(event, 'library', async (library) => {
		const id = uuidSchema.safeParse(event.params.id);
		if (!id.success) return errorResponse('NOT_FOUND');
		const { format } = await parseBody(event.request, changeFormatRequestSchema);
		const book = await library.changeFormat({ bookId: id.data, format });
		return json({ contractVersion: 1, book });
	});
