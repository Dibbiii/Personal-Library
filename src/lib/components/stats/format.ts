const numberFormat = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });

/** Numeri all'italiana con il punto delle migliaia anche sotto le 5 cifre: 1.008, 18.420. */
export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

export function plural(count: number, one: string, many: string): string {
	return count === 1 ? one : many;
}

/** "14 libri", "1 libro". */
export function countLabel(count: number, one: string, many: string): string {
	return `${formatNumber(count)} ${plural(count, one, many)}`;
}

export const MONTH_NAMES = [
	'Gennaio',
	'Febbraio',
	'Marzo',
	'Aprile',
	'Maggio',
	'Giugno',
	'Luglio',
	'Agosto',
	'Settembre',
	'Ottobre',
	'Novembre',
	'Dicembre'
] as const;

export function monthName(month: number): string {
	return MONTH_NAMES[month - 1] ?? '';
}

/** "Patrick Rothfuss" -> "P. Rothfuss"; "J.R.R. Tolkien" e nomi singoli restano intatti. */
export function abbreviateAuthor(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length < 2) return name.trim();
	const last = parts[parts.length - 1] ?? '';
	const initials = parts.slice(0, -1).map((part) => {
		if (part.includes('.') || part.length <= 2) return part;
		return `${part.charAt(0).toUpperCase()}.`;
	});
	return [...initials, last].join(' ');
}

/** Frase di avanzamento della card Bingo. */
export function bingoRemaining(completed: number, total = 16): string {
	const left = total - completed;
	if (left <= 0) return 'Bingo completo!';
	return `Ancora ${left} ${plural(left, 'casella', 'caselle')} per il bingo`;
}

/** Sottotitolo di una card nell'elenco "Le tue card". */
export function bingoBoardStatus(completed: number, total = 16): string {
	const head = `${completed} su ${total}`;
	if (completed >= total) return `${head} · Bingo completo!`;
	if (completed >= 10) return `${head} · Quasi!`;
	if (completed === 0) return `${head} · Da iniziare`;
	return `${head} · In corso`;
}
