export interface ParsedPublishedDate {
	/** YYYY-MM-DD se il giorno è noto */
	date: string | null;
	year: number | null;
}

const MONTHS: Record<string, number> = {
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	may: 5,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	oct: 10,
	nov: 11,
	dec: 12
};

function validYear(year: number): number | null {
	return year >= 1000 && year <= 3000 ? year : null;
}

function isoDate(year: number, month: number, day: number): string | null {
	if (validYear(year) === null) return null;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	return date.toISOString().slice(0, 10);
}

/**
 * Le date dei provider sono stringhe libere: "2005", "2019-11", "2019-11-14", "Nov 14, 2019",
 * "August 1, 1978". Si estrae il massimo che è certo (data completa oppure solo anno).
 */
export function parsePublishedDate(value: string | null | undefined): ParsedPublishedDate {
	const text = value?.trim();
	if (!text) return { date: null, year: null };

	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (iso) {
		const date = isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
		return { date, year: validYear(Number(iso[1])) };
	}

	const named = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
	if (named) {
		const month = MONTHS[(named[1] as string).slice(0, 3).toLowerCase()];
		const year = Number(named[3]);
		const date = month ? isoDate(year, month, Number(named[2])) : null;
		return { date, year: validYear(year) };
	}

	const yearMatch = /(?:^|\D)(\d{4})(?:\D|$)/.exec(text);
	return { date: null, year: yearMatch ? validYear(Number(yearMatch[1])) : null };
}
