import type { LifecycleState, ReadingStatus } from '$lib/contracts/enums';
import type { SeriesBook } from '$lib/contracts/books';
import type { ReadingOperation } from './reading-contract';

/**
 * Logica pura del ciclo di lettura (nessun I/O): derivazione dello stato mostrato in UI,
 * mappatura stato -> operazioni reali, classificazione degli aggiornamenti pagina.
 * MASTER_SPEC §7, §8, §27.
 */

// ---------------------------------------------------------------------------
// Stato derivato
// ---------------------------------------------------------------------------

/** Le voci dello sheet "Stato di lettura". Solo alcune sono stati reali: `rereads` è derivato. */
export type StatusChoice = 'unread' | 'reading' | 'paused' | 'finished' | 'rereads' | 'dnf';

export const STATUS_CHOICES: readonly StatusChoice[] = [
	'unread',
	'reading',
	'paused',
	'finished',
	'rereads',
	'dnf'
];

export const STATUS_CHOICE_LABELS: Record<StatusChoice, string> = {
	unread: 'TBR',
	reading: 'In lettura',
	paused: 'In pausa',
	finished: 'Letto',
	rereads: 'Letto più di una volta',
	dnf: 'Non finito (DNF)'
};

export interface BookLifecycle {
	lifecycleState: LifecycleState;
	completedReadingsCount: number;
}

/** "Letto più di una volta" = completedReadingsCount >= 2 (spec §27): mai salvato come stato. */
export function currentStatusChoice(book: BookLifecycle): StatusChoice {
	if (book.lifecycleState === 'finished') {
		return book.completedReadingsCount >= 2 ? 'rereads' : 'finished';
	}
	return book.lifecycleState;
}

/** La recensione si sblocca con almeno una lettura completata, non con lo stato corrente (spec §6). */
export function isReviewUnlocked(book: Pick<BookLifecycle, 'completedReadingsCount'>): boolean {
	return book.completedReadingsCount >= 1;
}

// ---------------------------------------------------------------------------
// Stato -> operazioni
// ---------------------------------------------------------------------------

export type PlanStep = 'start' | 'pause' | 'resume' | 'finish' | 'dnf' | 'addCompleted';

/** Dati che la UI deve raccogliere prima di salvare. */
export type PlanInput = 'dates' | 'dnfPage';

export type StatusPlan =
	| { kind: 'none' }
	| { kind: 'unavailable'; reason: string }
	| { kind: 'run'; steps: PlanStep[]; inputs: PlanInput[] };

export interface PlanContext extends BookLifecycle {
	/** C'è una lettura aperta (active o paused). */
	hasOpenReading: boolean;
}

const NONE: StatusPlan = { kind: 'none' };

/**
 * Cosa fare per portare il libro dalla situazione attuale allo stato scelto.
 * Le letture sono immutabili: non si torna a TBR e non si entra in pausa senza una lettura in corso.
 */
export function planStatusChange(context: PlanContext, target: StatusChoice): StatusPlan {
	const current = currentStatusChoice(context);
	if (target === current) return NONE;

	const { hasOpenReading, completedReadingsCount: completed } = context;

	switch (target) {
		case 'unread':
			return {
				kind: 'unavailable',
				reason: 'Il libro ha già delle letture registrate.'
			};

		case 'reading':
			if (context.lifecycleState === 'paused') {
				return { kind: 'run', steps: ['resume'], inputs: [] };
			}
			return { kind: 'run', steps: ['start'], inputs: [] };

		case 'paused':
			if (context.lifecycleState === 'reading') {
				return { kind: 'run', steps: ['pause'], inputs: [] };
			}
			return { kind: 'unavailable', reason: 'Solo per un libro in lettura.' };

		case 'finished':
			if (hasOpenReading) return { kind: 'run', steps: ['finish'], inputs: [] };
			// Già letto (derivato): nessuna nuova lettura da registrare.
			if (completed >= 1) return NONE;
			return { kind: 'run', steps: ['addCompleted'], inputs: ['dates'] };

		case 'rereads':
			if (completed < 1) {
				return {
					kind: 'unavailable',
					reason: 'Dopo la prima lettura completata.'
				};
			}
			if (hasOpenReading) return { kind: 'run', steps: ['finish'], inputs: [] };
			// Letto una volta sola: la seconda lettura completata lo rende "più di una volta".
			return { kind: 'run', steps: ['addCompleted'], inputs: ['dates'] };

		case 'dnf':
			if (hasOpenReading) return { kind: 'run', steps: ['dnf'], inputs: ['dnfPage'] };
			return { kind: 'run', steps: ['start', 'dnf'], inputs: ['dnfPage'] };
	}
}

// ---------------------------------------------------------------------------
// Pagine e avanzamento
// ---------------------------------------------------------------------------

export type PageUpdate =
	| { kind: 'noop' }
	| { kind: 'invalid'; reason: 'not-integer' | 'negative' | 'beyond-total' }
	| { kind: 'progress' | 'correction'; operation: ReadingOperation; delta: number };

/**
 * `progress` se la pagina avanza, `correction` se è minore dell'attuale (corregge il totale
 * già registrato, delta negativo: non è "lettura negativa", spec §8).
 */
export function classifyPageUpdate(
	currentPage: number,
	nextPage: number,
	pageCount: number | null
): PageUpdate {
	if (!Number.isInteger(nextPage)) return { kind: 'invalid', reason: 'not-integer' };
	if (nextPage < 0) return { kind: 'invalid', reason: 'negative' };
	if (pageCount !== null && nextPage > pageCount) {
		return { kind: 'invalid', reason: 'beyond-total' };
	}
	if (nextPage === currentPage) return { kind: 'noop' };
	const delta = nextPage - currentPage;
	return delta > 0
		? { kind: 'progress', operation: 'progress', delta }
		: { kind: 'correction', operation: 'correction', delta };
}

/** Percentuale intera 0..100; null se il totale è ignoto. */
export function progressPercent(page: number, total: number | null): number | null {
	if (total === null || total <= 0) return null;
	return Math.max(0, Math.min(100, Math.round((page / total) * 100)));
}

/** Pagina da usare come "finale" per chiudere una lettura: il totale se noto, altrimenti l'attuale. */
export function finalPageFor(currentPage: number, pageCount: number | null): number {
	return pageCount !== null ? Math.max(pageCount, currentPage) : currentPage;
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

/** YYYY-MM-DD nel fuso del dispositivo (è la `localDate` degli eventi). */
export function toLocalDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO-8601 di mezzogiorno locale del giorno dato: evita slittamenti di data col fuso. */
export function localDateToIso(localDate: string): string {
	const [y, m, d] = localDate.split('-').map(Number);
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0).toISOString();
}

export type DateRangeProblem = 'invalid' | 'future' | 'order' | null;

/** Controlla un intervallo di lettura storico (inizio <= fine <= oggi). */
export function validateDateRange(start: string, end: string, today: string): DateRangeProblem {
	const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
	if (!isDate(start) || !isDate(end)) return 'invalid';
	if (end > today || start > today) return 'future';
	if (start > end) return 'order';
	return null;
}

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'Europe/Rome'
});

/** "12 mar 2024" */
export function formatReadingDate(iso: string): string {
	return DATE_FORMAT.format(new Date(iso)).replace(/\./g, '');
}

export interface ReadingLike {
	status: ReadingStatus;
	startedAt: string;
	endedAt: string | null;
	startPage: number;
	currentPage: number;
}

/** "12 mar 2024 → 29 mar 2024"; per una lettura aperta "12 mar 2024 → in corso". */
export function formatReadingRange(reading: ReadingLike): string {
	const start = formatReadingDate(reading.startedAt);
	if (reading.endedAt) return `${start} → ${formatReadingDate(reading.endedAt)}`;
	return `${start} → ${reading.status === 'paused' ? 'in pausa' : 'in corso'}`;
}

/** Etichetta della lettura nello storico: la prima è "1ª lettura", le altre "Rilettura". */
export function readingSequenceLabel(sequence: number): string {
	return sequence <= 1 ? '1ª lettura' : 'Rilettura';
}

// ---------------------------------------------------------------------------
// Serie
// ---------------------------------------------------------------------------

export interface SeriesVolume {
	number: number;
	book: Pick<SeriesBook, 'id' | 'title'> | null;
}

/**
 * Crea gli slot della serie dai libri realmente presenti e dal totale dichiarato.
 * Un volume precedente non viene considerato letto solo in base al numero.
 */
export function seriesVolumes(books: SeriesBook[], total: number | null): SeriesVolume[] {
	const booksByNumber = new Map<number, SeriesBook[]>();
	for (const book of books) {
		if (book.number === null || !Number.isFinite(book.number) || book.number <= 0) continue;
		const sameVolume = booksByNumber.get(book.number) ?? [];
		sameVolume.push(book);
		booksByNumber.set(book.number, sameVolume);
	}

	for (const sameVolume of booksByNumber.values()) {
		sameVolume.sort((a, b) => a.title.localeCompare(b.title, 'it') || a.id.localeCompare(b.id));
	}

	const lastVolume = Math.max(
		total ?? 0,
		...Array.from(booksByNumber.keys(), (number) => Math.ceil(number)),
		0
	);
	if (lastVolume === 0) return [];

	const numbers = new Set<number>();
	for (let number = 1; number <= lastVolume; number++) numbers.add(number);
	for (const number of booksByNumber.keys()) numbers.add(number);

	return Array.from(numbers)
		.sort((a, b) => a - b)
		.flatMap((number): SeriesVolume[] => {
			const sameVolume = booksByNumber.get(number);
			return sameVolume?.length
				? sameVolume.map((book) => ({
						number,
						book: { id: book.id, title: book.title }
					}))
				: [{ number, book: null }];
		});
}

/** "Vol. 2 di 3" (o "Vol. 2" se il totale è ignoto). */
export function seriesVolumeLabel(number: number | null, total: number | null): string | null {
	if (number === null) return null;
	const n = Number.isInteger(number) ? String(number) : String(number).replace('.', ',');
	return total !== null ? `Vol. ${n} di ${total}` : `Vol. ${n}`;
}
