import type { SeriesRef } from '$lib/contracts/books';
import { hasAtMostTwoDecimals, seriesInputSchema } from './schemas';

/** '' -> null, numero valido -> number, altro -> undefined. */
export function parseSeriesNumber(text: string): number | null | undefined {
	const value = text.trim().replace(',', '.');
	if (value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function validateSeriesFields(
	name: string,
	number: number | null | undefined,
	total: number | null | undefined
): string | null {
	if (number === undefined) return 'Il numero del volume deve essere maggiore di zero.';
	if (number !== null && number > 9999) return 'Il numero del volume non può superare 9999.';
	if (number !== null && !hasAtMostTwoDecimals(number))
		return 'Il numero del volume può avere al massimo due decimali.';
	if (total === undefined || (total !== null && (!Number.isInteger(total) || total > 999)))
		return 'Il totale dei volumi deve essere un intero tra 1 e 999.';
	if (number !== null && total !== null && number > total)
		return 'Il numero del volume non può superare il totale.';

	const trimmedName = name.trim();
	if ((number !== null || total !== null) && !trimmedName)
		return 'Scrivi anche il nome della serie.';
	if (trimmedName.length > 160)
		return 'Il nome della serie può contenere al massimo 160 caratteri.';
	if (!trimmedName) return null;

	return seriesInputSchema.safeParse({ name: trimmedName, number, total }).success
		? null
		: 'Dati della serie non validi.';
}

export function seriesRefFromFields(
	name: string,
	number: number | null | undefined,
	total: number | null | undefined
): SeriesRef | null {
	const trimmedName = name.trim();
	if (!trimmedName) return null;
	return {
		name: trimmedName,
		number: number ?? null,
		total: total ?? null
	};
}
