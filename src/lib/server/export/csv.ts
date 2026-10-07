import type { ExportBook } from '$lib/contracts/settings';

const STATE_LABELS: Record<string, string> = {
	unread: 'TBR',
	reading: 'In lettura',
	paused: 'In pausa',
	finished: 'Letto',
	dnf: 'Non finito (DNF)'
};

const FORMAT_LABELS: Record<string, string> = {
	physical: 'Cartaceo',
	digital: 'Digitale',
	both: 'Cartaceo e digitale'
};

export const BOOK_CSV_HEADER = [
	'Titolo',
	'Autore',
	'Genere',
	'Formato',
	'Pagine',
	'ISBN-13',
	'ISBN-10',
	'Lingua',
	'Serie',
	'Numero nella serie',
	'Stato',
	'Letture completate',
	'Voto',
	'Ultima lettura finita',
	'Tag',
	'Aggiunto il'
] as const;

/**
 * Una cella CSV: virgolette raddoppiate e, contro la formula injection dei fogli di calcolo,
 * un apice iniziale sui testi che comincerebbero con = + - @ o un carattere di controllo.
 */
export function csvCell(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '';
	let text = String(value);
	if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function dateOnly(iso: string | null): string {
	return iso ? iso.slice(0, 10) : '';
}

export function booksToCsv(books: readonly ExportBook[]): string {
	const rows = books.map((book) =>
		[
			book.title,
			book.author,
			book.genreName,
			FORMAT_LABELS[book.format] ?? book.format,
			book.pageCount,
			book.isbn13,
			book.isbn10,
			book.language,
			book.seriesName,
			book.seriesNumber,
			STATE_LABELS[book.lifecycleState] ?? book.lifecycleState,
			book.completedReadingsCount,
			book.rating,
			dateOnly(book.lastFinishedAt),
			book.tags.join('; '),
			dateOnly(book.createdAt)
		]
			.map(csvCell)
			.join(',')
	);

	// BOM UTF-8: Excel apre correttamente gli accenti. Righe CRLF come da RFC 4180.
	return '﻿' + [BOOK_CSV_HEADER.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}
