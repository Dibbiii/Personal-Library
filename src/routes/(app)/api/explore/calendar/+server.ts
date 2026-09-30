import { json } from '@sveltejs/kit';
import { readingCalendarResponseSchema } from '$lib/contracts/rpc';
import { MAX_YEAR, MIN_YEAR } from '$lib/explore/calendar';
import { errorResponse, handle } from '../../reading/_http';
import type { RequestHandler } from './$types';

/** Calendario di lettura di un anno: `GET /api/explore/calendar?year=2025`. */
export const GET: RequestHandler = (event) =>
	handle(event, 'stats', async (stats) => {
		const raw = event.url.searchParams.get('year');
		const year = raw !== null && /^\d{4}$/.test(raw) ? Number(raw) : NaN;
		if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
			return errorResponse('VALIDATION', 'Anno non valido.');
		}
		const calendar = await stats.getCalendar(year);
		return json(readingCalendarResponseSchema.parse(calendar), {
			headers: { 'cache-control': 'private, no-store' }
		});
	});
