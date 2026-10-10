import { describe, expect, it } from 'vitest';
import {
	classifyPageUpdate,
	currentStatusChoice,
	finalPageFor,
	formatReadingRange,
	isReviewUnlocked,
	localDateToIso,
	planStatusChange,
	progressPercent,
	readingSequenceLabel,
	seriesVolumeLabel,
	seriesVolumes,
	toLocalDate,
	validateDateRange,
	type PlanContext
} from '../../src/lib/client/reading-logic';

const ctx = (partial: Partial<PlanContext>): PlanContext => ({
	lifecycleState: 'unread',
	completedReadingsCount: 0,
	hasOpenReading: false,
	...partial
});

describe('stato derivato', () => {
	it('"Letto più di una volta" è derivato da completedReadingsCount >= 2', () => {
		expect(currentStatusChoice({ lifecycleState: 'finished', completedReadingsCount: 1 })).toBe(
			'finished'
		);
		expect(currentStatusChoice({ lifecycleState: 'finished', completedReadingsCount: 2 })).toBe(
			'rereads'
		);
		expect(currentStatusChoice({ lifecycleState: 'finished', completedReadingsCount: 5 })).toBe(
			'rereads'
		);
	});

	it('gli altri stati passano invariati', () => {
		for (const state of ['unread', 'reading', 'paused', 'dnf'] as const) {
			expect(currentStatusChoice({ lifecycleState: state, completedReadingsCount: 0 })).toBe(state);
		}
		// Rilettura in corso: resta "in lettura"
		expect(currentStatusChoice({ lifecycleState: 'reading', completedReadingsCount: 1 })).toBe(
			'reading'
		);
	});

	it('la recensione dipende dalle letture completate, non dallo stato corrente', () => {
		expect(isReviewUnlocked({ completedReadingsCount: 0 })).toBe(false);
		expect(isReviewUnlocked({ completedReadingsCount: 1 })).toBe(true);
	});
});

describe('planStatusChange', () => {
	it('stesso stato = nessuna operazione', () => {
		expect(planStatusChange(ctx({}), 'unread')).toEqual({ kind: 'none' });
		expect(
			planStatusChange(ctx({ lifecycleState: 'finished', completedReadingsCount: 1 }), 'finished')
		).toEqual({ kind: 'none' });
	});

	it('TBR non è raggiungibile quando esistono letture', () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'finished', completedReadingsCount: 1 }), 'unread')
				.kind
		).toBe('unavailable');
		expect(
			planStatusChange(ctx({ lifecycleState: 'reading', hasOpenReading: true }), 'unread').kind
		).toBe('unavailable');
	});

	it('da TBR a In lettura avvia una lettura', () => {
		expect(planStatusChange(ctx({}), 'reading')).toEqual({
			kind: 'run',
			steps: ['start'],
			inputs: []
		});
	});

	it('da In pausa a In lettura riprende', () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'paused', hasOpenReading: true }), 'reading')
		).toEqual({ kind: 'run', steps: ['resume'], inputs: [] });
	});

	it('la pausa richiede una lettura attiva', () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'reading', hasOpenReading: true }), 'paused')
		).toEqual({ kind: 'run', steps: ['pause'], inputs: [] });
		expect(planStatusChange(ctx({}), 'paused').kind).toBe('unavailable');
	});

	it('da TBR a Letto registra una lettura storica con date', () => {
		expect(planStatusChange(ctx({}), 'finished')).toEqual({
			kind: 'run',
			steps: ['addCompleted'],
			inputs: ['dates']
		});
	});

	it('da In lettura a Letto chiude la lettura aperta', () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'reading', hasOpenReading: true }), 'finished')
		).toEqual({ kind: 'run', steps: ['finish'], inputs: [] });
	});

	it('da Letto (1) a Letto più di una volta aggiunge una seconda lettura completata', () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'finished', completedReadingsCount: 1 }), 'rereads')
		).toEqual({ kind: 'run', steps: ['addCompleted'], inputs: ['dates'] });
	});

	it('"più di una volta" non è disponibile senza una lettura completata', () => {
		expect(planStatusChange(ctx({}), 'rereads').kind).toBe('unavailable');
		expect(
			planStatusChange(ctx({ lifecycleState: 'reading', hasOpenReading: true }), 'rereads').kind
		).toBe('unavailable');
	});

	it('da rilettura in corso, finire la lettura rende il libro "più di una volta"', () => {
		const reread = ctx({
			lifecycleState: 'reading',
			completedReadingsCount: 1,
			hasOpenReading: true
		});
		expect(planStatusChange(reread, 'rereads')).toEqual({
			kind: 'run',
			steps: ['finish'],
			inputs: []
		});
		expect(planStatusChange(reread, 'finished')).toEqual({
			kind: 'run',
			steps: ['finish'],
			inputs: []
		});
	});

	it("DNF: con lettura aperta chiude alla pagina scelta senza avviare un'altra lettura", () => {
		expect(
			planStatusChange(ctx({ lifecycleState: 'reading', hasOpenReading: true }), 'dnf')
		).toEqual({ kind: 'run', steps: ['dnf'], inputs: ['dnfPage'] });
		expect(planStatusChange(ctx({}), 'dnf')).toEqual({
			kind: 'run',
			steps: ['start', 'dnf'],
			inputs: ['dnfPage']
		});
	});
});

describe('aggiornamento pagina', () => {
	it('avanzamento, correzione e nessuna modifica', () => {
		expect(classifyPageUpdate(214, 247, 712)).toEqual({
			kind: 'progress',
			operation: 'progress',
			delta: 33
		});
		expect(classifyPageUpdate(180, 170, 712)).toEqual({
			kind: 'correction',
			operation: 'correction',
			delta: -10
		});
		expect(classifyPageUpdate(10, 10, 100)).toEqual({ kind: 'noop' });
	});

	it('rifiuta pagine non valide', () => {
		expect(classifyPageUpdate(10, -1, 100)).toEqual({ kind: 'invalid', reason: 'negative' });
		expect(classifyPageUpdate(10, 1.5, 100)).toEqual({ kind: 'invalid', reason: 'not-integer' });
		expect(classifyPageUpdate(10, 101, 100)).toEqual({ kind: 'invalid', reason: 'beyond-total' });
		expect(classifyPageUpdate(10, 5000, null).kind).toBe('progress');
	});

	it('percentuale e pagina finale', () => {
		expect(progressPercent(214, 712)).toBe(30);
		expect(progressPercent(0, 712)).toBe(0);
		expect(progressPercent(900, 712)).toBe(100);
		expect(progressPercent(10, null)).toBeNull();
		expect(finalPageFor(214, 712)).toBe(712);
		expect(finalPageFor(214, null)).toBe(214);
		expect(finalPageFor(800, 712)).toBe(800);
	});
});

describe('date', () => {
	it('toLocalDate e localDateToIso sono coerenti', () => {
		expect(toLocalDate(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
		expect(toLocalDate(new Date(localDateToIso('2026-03-05')))).toBe('2026-03-05');
	});

	it('valida gli intervalli', () => {
		expect(validateDateRange('2026-01-01', '2026-01-10', '2026-09-30')).toBeNull();
		expect(validateDateRange('2026-01-10', '2026-01-01', '2026-09-30')).toBe('order');
		expect(validateDateRange('2026-01-01', '2026-12-01', '2026-09-30')).toBe('future');
		expect(validateDateRange('', '2026-01-01', '2026-09-30')).toBe('invalid');
	});

	it('formatta intervalli in italiano', () => {
		const done = formatReadingRange({
			status: 'completed',
			startedAt: '2024-03-12T12:00:00.000Z',
			endedAt: '2024-03-29T12:00:00.000Z',
			startPage: 0,
			currentPage: 662
		});
		expect(done).toBe('12 mar 2024 → 29 mar 2024');
		expect(
			formatReadingRange({
				status: 'active',
				startedAt: '2026-01-03T12:00:00.000Z',
				endedAt: null,
				startPage: 0,
				currentPage: 10
			})
		).toBe('3 gen 2026 → in corso');
	});

	it('etichette di sequenza', () => {
		expect(readingSequenceLabel(1)).toBe('1ª lettura');
		expect(readingSequenceLabel(2)).toBe('Rilettura');
	});
});

describe('serie', () => {
	it('ordina i volumi presenti e rappresenta gli slot mancanti senza inferire che siano letti', () => {
		expect(
			seriesVolumes(
				[
					{ id: 'book-3', title: 'Terzo volume', number: 3 },
					{ id: 'book-1', title: 'Primo volume', number: 1 }
				],
				4
			)
		).toEqual([
			{ number: 1, book: { id: 'book-1', title: 'Primo volume' } },
			{ number: 2, book: null },
			{ number: 3, book: { id: 'book-3', title: 'Terzo volume' } },
			{ number: 4, book: null }
		]);
	});

	it('usa l’ultimo volume presente quando il totale non è noto e ordina i volumi intermedi', () => {
		expect(
			seriesVolumes(
				[
					{ id: 'book-3', title: 'Terzo volume', number: 3 },
					{ id: 'book-1', title: 'Primo volume', number: 1 }
				],
				null
			)
		).toEqual([
			{ number: 1, book: { id: 'book-1', title: 'Primo volume' } },
			{ number: 2, book: null },
			{ number: 3, book: { id: 'book-3', title: 'Terzo volume' } }
		]);
	});

	it('ordina numeri intermedi e volumi con lo stesso numero in modo stabile', () => {
		expect(
			seriesVolumes(
				[
					{ id: 'book-b', title: 'Volume bis', number: 2 },
					{ id: 'book-c', title: 'Volume 1 e mezzo', number: 1.5 },
					{ id: 'book-a-copy', title: 'Volume uno - altra edizione', number: 1 },
					{ id: 'book-a', title: 'Volume uno', number: 1 }
				],
				2
			).map((volume) => [volume.number, volume.book?.id ?? null])
		).toEqual([
			[1, 'book-a'],
			[1, 'book-a-copy'],
			[1.5, 'book-c'],
			[2, 'book-b']
		]);

		expect(seriesVolumeLabel(2, 3)).toBe('Vol. 2 di 3');
		expect(seriesVolumeLabel(2, null)).toBe('Vol. 2');
		expect(seriesVolumeLabel(null, 3)).toBeNull();
	});
});
