import type { Reading } from '$lib/contracts/readings';
import {
	addCompletedReading,
	newEventId,
	pauseReading,
	resumeReading,
	startReading,
	submitReadingOp,
	type ReadingOpResult
} from './reading';
import type { ReadingOperation } from './reading-contract';
import { finalPageFor, localDateToIso, toLocalDate, type PlanStep } from './reading-logic';

/**
 * Esecuzione delle operazioni pianificate da `planStatusChange`. I passi sono sequenziali:
 * `start` produce l'id della lettura usato dal passo successivo.
 */

export interface ActionBook {
	id: string;
	pageCount: number | null;
}

export interface StatusActionInputs {
	/** YYYY-MM-DD, richiesto dal passo addCompleted. */
	startDate?: string;
	endDate?: string;
	/** Pagina a cui ci si ferma (DNF). */
	dnfPage?: number;
}

export interface RunOutcome {
	/** Almeno un evento è rimasto in coda offline: si sincronizzerà al ritorno della rete. */
	queued: boolean;
	readingId: string | null;
}

function eventRequest(readingId: string, page: number, operation: ReadingOperation, now: Date) {
	return {
		eventId: newEventId(),
		readingId,
		page,
		occurredAt: now.toISOString(),
		localDate: toLocalDate(now),
		operation
	};
}

export async function runPlanSteps(
	steps: readonly PlanStep[],
	book: ActionBook,
	current: Pick<Reading, 'id' | 'currentPage'> | null,
	inputs: StatusActionInputs = {}
): Promise<RunOutcome> {
	let readingId = current?.id ?? null;
	let page = current?.currentPage ?? 0;
	let queued = false;

	const track = (outcome: ReadingOpResult) => {
		if (outcome.status === 'queued') queued = true;
	};

	for (const step of steps) {
		const now = new Date();
		switch (step) {
			case 'start': {
				const result = await startReading({ bookId: book.id });
				readingId = result.reading.id;
				page = result.reading.currentPage;
				break;
			}
			case 'pause':
				if (!readingId) throw new Error('Nessuna lettura da mettere in pausa');
				await pauseReading(readingId);
				break;
			case 'resume':
				if (!readingId) throw new Error('Nessuna lettura da riprendere');
				await resumeReading(readingId);
				break;
			case 'finish': {
				if (!readingId) throw new Error('Nessuna lettura da chiudere');
				track(
					await submitReadingOp(
						eventRequest(readingId, finalPageFor(page, book.pageCount), 'finish', now)
					)
				);
				break;
			}
			case 'dnf': {
				if (!readingId) throw new Error('Nessuna lettura da chiudere');
				track(await submitReadingOp(eventRequest(readingId, inputs.dnfPage ?? page, 'dnf', now)));
				break;
			}
			case 'addCompleted': {
				const end = inputs.endDate ?? toLocalDate(now);
				const start = inputs.startDate ?? end;
				const result = await addCompletedReading({
					bookId: book.id,
					startedAt: localDateToIso(start),
					finishedAt: localDateToIso(end),
					finalPage: book.pageCount ?? 0
				});
				readingId = result.reading.id;
				break;
			}
		}
	}

	return { queued, readingId };
}

/** Aggiornamento pagina (progress o correction) per una lettura aperta. */
export function submitPageUpdate(
	readingId: string,
	page: number,
	operation: 'progress' | 'correction'
) {
	return submitReadingOp(eventRequest(readingId, page, operation, new Date()));
}

/** "Ho finito" con pagina finale esplicita. */
export function submitFinish(readingId: string, page: number) {
	return submitReadingOp(eventRequest(readingId, page, 'finish', new Date()));
}

/** "Non finito" alla pagina data. */
export function submitDnf(readingId: string, page: number) {
	return submitReadingOp(eventRequest(readingId, page, 'dnf', new Date()));
}
